import type { Db } from '@/data/db';
import { mergeAll, type MergedTxn } from '@/domain/parse/merge';
import { parseSms } from '@/domain/parse/parse';
import { PARSER_VERSION, type MessageKind, type ParsedFragment } from '@/domain/parse/types';
import type { Pesewas } from '@/domain/money';

import { categorise, loadCategoriserContext, type CategoriserContext } from './categorise';

export interface IngestItem {
  source: 'backup' | 'inbox';
  body: string;
  receivedAt: number;
  /** Required for 'inbox': the id is half of that source's message identity. */
  androidId?: number;
}

export interface IngestCounts {
  parsed: number;
  ignored: number;
  unparsed: number;
  errors: number;
  /** Distinct transactions this batch wrote. */
  transactions: number;
  /** Distinct outgoing transactions among them. */
  payments: number;
}

export interface IngestResult extends IngestCounts {
  /** Lets a caller that ingests in several batches count a payment split across batches once. */
  paymentIds: ReadonlySet<string>;
}

type Flow = 'spend' | 'income' | 'credit';

const FLOW: Record<MessageKind, Flow> = {
  payment_out: 'spend',
  cash_out: 'spend',
  transfer_out: 'spend',
  payment_in: 'income',
  cash_in: 'income',
  interest: 'income',
  refund: 'credit',
  reversal: 'credit',
};

const SENDER = 'MobileMoney';

interface FragmentRow {
  momo_txn_id: string;
  kind: MessageKind;
  flow: Flow;
  amount_pesewas: number;
  fee_pesewas: number | null;
  tax_pesewas: number | null;
  balance_after_pesewas: number | null;
  counterparty_name: string | null;
  merchant_code: string | null;
  counterparty_number: string | null;
  reference: string | null;
  occurred_at: number;
  occurred_at_source: 'body' | 'received';
  template_name: string;
  template_version: number;
  received_at: number;
  android_sms_id: number | null;
}

// Stored rows carry no Android id for backup messages, so the tie-break in mergeAll must not
// depend on one: it falls through to receivedAt and template name, which are the same either way.
function toFragment(r: FragmentRow): ParsedFragment {
  return {
    momoTxnId: r.momo_txn_id,
    kind: r.kind,
    direction: r.flow === 'spend' ? 'out' : 'in',
    amount: r.amount_pesewas as Pesewas,
    fee: r.fee_pesewas as Pesewas | null,
    tax: r.tax_pesewas as Pesewas | null,
    balanceAfter: r.balance_after_pesewas as Pesewas | null,
    counterpartyName: r.counterparty_name,
    merchantCode: r.merchant_code,
    counterpartyNumber: r.counterparty_number,
    reference: r.reference,
    occurredAt: { at: r.occurred_at, source: r.occurred_at_source },
    receivedAt: r.received_at,
    androidId: r.android_sms_id === null ? '' : String(r.android_sms_id),
    template: { name: r.template_name, version: r.template_version },
  };
}

async function upsertMessage(
  tx: Db,
  item: IngestItem,
  status: 'parsed' | 'ignored' | 'unparsed' | 'error',
  reason: string | null,
  backupKey: string | null,
  now: number,
): Promise<number> {
  const isBackup = item.source === 'backup';
  const identity = isBackup
    ? 'ON CONFLICT(backup_key) WHERE backup_key IS NOT NULL'
    : 'ON CONFLICT(android_sms_id, received_at)';
  await tx.run(
    `INSERT INTO sms_messages (source, android_sms_id, backup_key, received_at, sender, status, reason,
       parser_version, first_seen_at, parsed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ${identity} DO UPDATE SET status = excluded.status, reason = excluded.reason,
       parser_version = excluded.parser_version, parsed_at = excluded.parsed_at`,
    [
      item.source,
      isBackup ? null : (item.androidId ?? null),
      backupKey,
      item.receivedAt,
      SENDER,
      status,
      reason,
      PARSER_VERSION,
      now,
      now,
    ],
  );
  const row = isBackup
    ? await tx.get<{ id: number }>('SELECT id FROM sms_messages WHERE backup_key = ?', [backupKey])
    : await tx.get<{ id: number }>(
        'SELECT id FROM sms_messages WHERE android_sms_id = ? AND received_at = ?',
        [item.androidId ?? null, item.receivedAt],
      );
  return row!.id;
}

async function upsertTransaction(
  tx: Db,
  m: MergedTxn,
  ctx: CategoriserContext,
  now: number,
): Promise<void> {
  const auto = categorise(
    {
      kind: m.kind,
      counterpartyName: m.counterpartyName,
      counterpartyNumber: m.counterpartyNumber,
      merchantCode: m.merchantCode,
      reference: m.reference,
    },
    ctx,
  );
  await tx.run(
    `INSERT INTO transactions (origin, momo_txn_id, flow, kind, amount_pesewas, fee_pesewas, tax_pesewas,
       balance_after_pesewas, counterparty_name, merchant_code, counterparty_number, sms_reference,
       reference_clean, auto_category_id, auto_category_source, is_self_transfer, has_conflict,
       occurred_at, occurred_at_source, created_at, updated_at)
     VALUES ('sms', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(momo_txn_id) DO UPDATE SET
       flow = excluded.flow, kind = excluded.kind, amount_pesewas = excluded.amount_pesewas,
       fee_pesewas = excluded.fee_pesewas, tax_pesewas = excluded.tax_pesewas,
       balance_after_pesewas = excluded.balance_after_pesewas,
       counterparty_name = excluded.counterparty_name, merchant_code = excluded.merchant_code,
       counterparty_number = excluded.counterparty_number, sms_reference = excluded.sms_reference,
       reference_clean = excluded.reference_clean, is_self_transfer = excluded.is_self_transfer,
       auto_category_id = excluded.auto_category_id,
       auto_category_source = excluded.auto_category_source,
       has_conflict = excluded.has_conflict, occurred_at = excluded.occurred_at,
       occurred_at_source = excluded.occurred_at_source, retracted_at = NULL,
       updated_at = excluded.updated_at`,
    [
      m.momoTxnId,
      FLOW[m.kind],
      m.kind,
      m.amount,
      m.fee ?? 0,
      m.tax ?? 0,
      m.balanceAfter,
      m.counterpartyName,
      m.merchantCode,
      m.counterpartyNumber,
      m.reference,
      auto.referenceClean,
      auto.categoryId,
      auto.source,
      auto.isSelfTransfer ? 1 : 0,
      m.hasConflict ? 1 : 0,
      m.occurredAt.at,
      m.occurredAt.source,
      now,
      now,
    ],
  );
}

/** Re-derives the transaction from every stored fragment, so the result never depends on arrival order. */
async function refold(
  tx: Db,
  momoTxnId: string,
  ctx: CategoriserContext,
  now: number,
): Promise<boolean> {
  const rows = await tx.all<FragmentRow>(
    `SELECT f.*, m.received_at, m.android_sms_id
     FROM sms_fragments f JOIN sms_messages m ON m.id = f.message_id
     WHERE f.momo_txn_id = ?`,
    [momoTxnId],
  );
  if (rows.length === 0) {
    await tx.run(
      'UPDATE transactions SET retracted_at = ?, updated_at = ? WHERE momo_txn_id = ? AND retracted_at IS NULL',
      [now, now, momoTxnId],
    );
    return false;
  }
  await upsertTransaction(tx, mergeAll(rows.map(toFragment)), ctx, now);
  return true;
}

async function ingestOne(
  tx: Db,
  item: IngestItem,
  ctx: CategoriserContext,
  now: number,
  touched: Map<string, Flow>,
  tally: IngestCounts,
): Promise<void> {
  if (item.source === 'inbox' && item.androidId === undefined) {
    throw new TypeError('an inbox message needs its androidId');
  }
  const result = parseSms({
    androidId: String(item.androidId ?? ''),
    sender: SENDER,
    body: item.body,
    receivedAt: item.receivedAt,
  });

  if (result.status !== 'parsed') {
    // A backup message that is not parsed has no txn id to key on, so it is only counted.
    if (result.status === 'ignored') tally.ignored += 1;
    else tally.unparsed += 1;
    if (item.source === 'backup') return;
    const id = await upsertMessage(
      tx,
      item,
      result.status,
      result.status === 'ignored' ? result.reason : null,
      null,
      now,
    );
    // A message that used to parse and no longer does stops contributing its fragment.
    const old = await tx.get<{ momo_txn_id: string }>(
      'SELECT momo_txn_id FROM sms_fragments WHERE message_id = ?',
      [id],
    );
    if (old) {
      await tx.run('DELETE FROM sms_fragments WHERE message_id = ?', [id]);
      await refold(tx, old.momo_txn_id, ctx, now);
    }
    return;
  }

  const f = result.fragment;
  tally.parsed += 1;
  const backupKey =
    item.source === 'backup' ? `${item.receivedAt}:${f.momoTxnId}:${f.template.name}` : null;
  const id = await upsertMessage(tx, item, 'parsed', null, backupKey, now);
  const previous = await tx.get<{ momo_txn_id: string }>(
    'SELECT momo_txn_id FROM sms_fragments WHERE message_id = ?',
    [id],
  );
  // The transaction row must exist before the fragment's deferred foreign key is checked at commit.
  await tx.run(
    `INSERT INTO sms_fragments (message_id, momo_txn_id, flow, kind, amount_pesewas, fee_pesewas,
       tax_pesewas, balance_after_pesewas, counterparty_name, merchant_code, counterparty_number,
       reference, occurred_at, occurred_at_source, template_name, template_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(message_id) DO UPDATE SET
       momo_txn_id = excluded.momo_txn_id, flow = excluded.flow, kind = excluded.kind,
       amount_pesewas = excluded.amount_pesewas, fee_pesewas = excluded.fee_pesewas,
       tax_pesewas = excluded.tax_pesewas, balance_after_pesewas = excluded.balance_after_pesewas,
       counterparty_name = excluded.counterparty_name, merchant_code = excluded.merchant_code,
       counterparty_number = excluded.counterparty_number, reference = excluded.reference,
       occurred_at = excluded.occurred_at, occurred_at_source = excluded.occurred_at_source,
       template_name = excluded.template_name, template_version = excluded.template_version`,
    [
      id,
      f.momoTxnId,
      FLOW[f.kind],
      f.kind,
      f.amount,
      f.fee,
      f.tax,
      f.balanceAfter,
      f.counterpartyName,
      f.merchantCode,
      f.counterpartyNumber,
      f.reference,
      f.occurredAt.at,
      f.occurredAt.source,
      f.template.name,
      f.template.version,
    ],
  );
  await refold(tx, f.momoTxnId, ctx, now);
  if (previous && previous.momo_txn_id !== f.momoTxnId) {
    await refold(tx, previous.momo_txn_id, ctx, now);
  }
  // Last, so a message that fails above never counts as a written transaction.
  touched.set(f.momoTxnId, FLOW[f.kind]);
}

// An inbox message that threw is stored as an error row, so "Messages we couldn't read" lists it
// and the scan does not re-read it on every run. A failure here only loses that row.
async function recordError(tx: Db, item: IngestItem, now: number): Promise<void> {
  await tx.exec('SAVEPOINT err');
  try {
    await upsertMessage(tx, item, 'error', 'error:ingest', null, now);
    await tx.exec('RELEASE err');
  } catch {
    await tx.exec('ROLLBACK TO err');
    await tx.exec('RELEASE err');
  }
}

export async function ingest(
  db: Db,
  batch: readonly IngestItem[],
  now: number = Date.now(),
): Promise<IngestResult> {
  const tally: IngestCounts = {
    parsed: 0,
    ignored: 0,
    unparsed: 0,
    errors: 0,
    transactions: 0,
    payments: 0,
  };
  const touched = new Map<string, Flow>();
  await db.transaction(async (tx) => {
    const ctx = await loadCategoriserContext(tx);
    for (const item of batch) {
      const before = { ...tally };
      await tx.exec('SAVEPOINT msg');
      try {
        await ingestOne(tx, item, ctx, now, touched, tally);
        await tx.exec('RELEASE msg');
      } catch {
        await tx.exec('ROLLBACK TO msg');
        await tx.exec('RELEASE msg');
        Object.assign(tally, before, { errors: before.errors + 1 });
        if (item.source === 'inbox') await recordError(tx, item, now);
      }
    }
  });
  tally.transactions = touched.size;
  const paymentIds = new Set([...touched].filter(([, flow]) => flow === 'spend').map(([id]) => id));
  tally.payments = paymentIds.size;
  return { ...tally, paymentIds };
}
