import type { Db } from '@/data/db';
import { finishScan } from '@/ledger/finishScan';
import { ingest, type IngestItem } from '@/ledger/ingest';
import { ledgerQueue, type WriteQueue } from '@/ledger/writeQueue';

import type { InboxRef, RawSmsRow, ScanOutcome, ScanProgress, SmsSource } from './types';

const SENDER = 'MobileMoney';
const PAGE = 500;

export interface ScannerOptions {
  db: Db;
  sms: SmsSource;
  /** Called after each page of new messages is stored. Not called when there is nothing to read. */
  onProgress?: (progress: ScanProgress) => void;
  now?: () => number;
  queue?: WriteQueue;
}

export interface Scanner {
  /**
   * Single-flight (system-design 7.7). A call made while a scan runs shares that scan's result and
   * makes it run once more afterwards, so a message that arrives mid-scan is never missed.
   */
  scan(): Promise<ScanOutcome>;
}

interface LiveRow {
  id: number;
  android_sms_id: number;
  received_at: number;
}

interface Plan {
  unseen: InboxRef[];
  retired: number;
}

/**
 * Compares the inbox with the stored inbox rows and brings `gone_at` up to date. An id whose
 * received_at changed is a reused id: the old row is retired and the id is read again as new.
 */
async function applyDiff(db: Db, refs: readonly InboxRef[], now: number): Promise<Plan> {
  const inbox = new Map<number, InboxRef>();
  for (const ref of refs) if (Number.isSafeInteger(ref.androidId)) inbox.set(ref.androidId, ref);

  return db.transaction(async (tx) => {
    const live = await tx.all<LiveRow>(
      `SELECT id, android_sms_id, received_at FROM sms_messages
       WHERE source = 'inbox' AND gone_at IS NULL`,
    );
    const liveById = new Map(live.map((r) => [r.android_sms_id, r]));

    const retire = live.filter((r) => inbox.get(r.android_sms_id)?.receivedAt !== r.received_at);
    for (const r of retire) {
      await tx.run('UPDATE sms_messages SET gone_at = ? WHERE id = ?', [now, r.id]);
    }

    const unseen = [...inbox.values()].filter(
      (ref) => liveById.get(ref.androidId)?.received_at !== ref.receivedAt,
    );
    // A message that left and came back with the same id and date is the same identity.
    for (const ref of unseen) {
      await tx.run(
        `UPDATE sms_messages SET gone_at = NULL
         WHERE android_sms_id = ? AND received_at = ? AND gone_at IS NOT NULL`,
        [ref.androidId, ref.receivedAt],
      );
    }
    return { unseen, retired: retire.length };
  });
}

// The sender was already filtered in Kotlin. This is the second lock, so a bug there cannot
// let another sender's text into the parser or the database.
const fromAllowedSender = (row: RawSmsRow) => row.sender.toLowerCase() === SENDER.toLowerCase();

// The parser ignores any body that starts with '<#>' as an OTP, so that stub records the row as
// ignored for the right reason without the code's text ever existing in JS.
const toItem = (row: RawSmsRow): IngestItem => ({
  source: 'inbox',
  body: row.isOtp ? '<#>' : (row.body ?? ''),
  receivedAt: row.receivedAt,
  androidId: row.androidId,
});

export function createScanner({
  db,
  sms,
  onProgress,
  now = Date.now,
  queue = ledgerQueue,
}: ScannerOptions): Scanner {
  async function runOnce(): Promise<ScanOutcome> {
    try {
      const permission = await sms.getPermissionStatus();
      if (permission !== 'granted') return { status: 'no_permission', permission };

      const refs = await sms.listMomoMessageIds();
      const { unseen, retired } = await applyDiff(db, refs, now());
      if (refs.length === 0) return { status: 'no_messages' };

      const ids = unseen.map((r) => r.androidId);
      const paymentIds = new Set<string>();
      const progress: ScanProgress = { read: 0, total: ids.length, payments: 0 };
      for (let i = 0; i < ids.length; i += PAGE) {
        const rows = (await sms.readMessagesByIds(ids.slice(i, i + PAGE))).filter(
          fromAllowedSender,
        );
        const result = await ingest(db, rows.map(toItem), now());
        result.paymentIds.forEach((id) => paymentIds.add(id));
        progress.read = Math.min(i + PAGE, ids.length);
        progress.payments = paymentIds.size;
        onProgress?.({ ...progress });
      }
      await finishScan(db, now());
      return {
        status: 'ok',
        read: ids.length,
        payments: paymentIds.size,
        changed: ids.length + retired > 0,
      };
    } catch {
      return { status: 'failed' };
    }
  }

  let last: ScanOutcome = { status: 'failed' };
  const task = async () => {
    last = await runOnce();
  };

  return {
    async scan() {
      await queue.runCoalesced(task);
      return last;
    },
  };
}
