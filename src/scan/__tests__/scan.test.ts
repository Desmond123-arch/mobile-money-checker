import { setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { getMeta } from '@/data/meta';
import { FAILED, HOUR, OTP, PROMO, T0, cashOut, paymentFor } from '@/ledger/__tests__/synthetic';

import { createScanner } from '../scan';
import type { ScanProgress } from '../types';
import { FakeMomoSms } from './fakeMomoSms';

const NOW = T0 + 100 * HOUR;

interface MessageRow {
  android_sms_id: number;
  received_at: number;
  status: string;
  reason: string | null;
  gone_at: number | null;
}

const messages = (db: Db) =>
  db.all<MessageRow>(
    `SELECT android_sms_id, received_at, status, reason, gone_at FROM sms_messages
     ORDER BY android_sms_id, received_at`,
  );

const onPhone = (db: Db, txnId: string) =>
  db
    .get<{ source_on_phone: number }>(
      `SELECT source_on_phone FROM transaction_list WHERE id =
       (SELECT id FROM transactions WHERE momo_txn_id = ?)`,
      [txnId],
    )
    .then((r) => r?.source_on_phone);

const pay = (androidId: number, txn: string, hours = androidId) => ({
  androidId,
  body: paymentFor(txn, '5.00', 'MTNBUNDLE'),
  receivedAt: T0 + hours * HOUR,
});

async function fixture() {
  const db = await setup();
  const sms = new FakeMomoSms();
  const progress: ScanProgress[] = [];
  const scanner = createScanner({ db, sms, now: () => NOW, onProgress: (p) => progress.push(p) });
  return { db, sms, scanner, progress };
}

describe('scan', () => {
  it('reads new messages, stores them and marks the first import done', async () => {
    const { db, sms, scanner, progress } = await fixture();
    sms.add(pay(1, '90000000001'), pay(2, '90000000002'), {
      androidId: 3,
      body: cashOut('90000000003', '50.00', 'BALOMI VENTURES'),
      receivedAt: T0 + 3 * HOUR,
    });

    const outcome = await scanner.scan();

    expect(outcome).toEqual({ status: 'ok', read: 3, payments: 3, changed: true });
    expect(progress).toEqual([
      { read: 0, total: 3, payments: 0 },
      { read: 3, total: 3, payments: 3 },
    ]);
    expect((await messages(db)).map((m) => [m.android_sms_id, m.status])).toEqual([
      [1, 'parsed'],
      [2, 'parsed'],
      [3, 'parsed'],
    ]);
    expect(await getMeta(db, 'first_import_done')).toBe('1');
    expect(await getMeta(db, 'first_import_at')).toBe(String(NOW));
    expect(await getMeta(db, 'last_import_at')).toBeNull();
    expect(await onPhone(db, '90000000001')).toBe(1);
  });

  it('reads nothing the second time', async () => {
    const { sms, scanner } = await fixture();
    sms.add(pay(1, '90000000001'));
    await scanner.scan();
    sms.readCalls.length = 0;

    expect(await scanner.scan()).toMatchObject({ status: 'ok', read: 0, changed: false });
    expect(sms.readCalls).toEqual([]);
  });

  it('reads only the ids it has not seen', async () => {
    const { sms, scanner } = await fixture();
    sms.add(pay(1, '90000000001'));
    await scanner.scan();
    sms.add(pay(2, '90000000002'));
    sms.readCalls.length = 0;

    await scanner.scan();

    expect(sms.readCalls).toEqual([[2]]);
  });

  it('retires a missing id and shows its transaction as no longer on the phone', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add(pay(1, '90000000001'), pay(2, '90000000002'));
    await scanner.scan();

    sms.remove(2);
    const outcome = await scanner.scan();

    expect(outcome).toMatchObject({ status: 'ok', changed: true });
    const rows = await messages(db);
    expect(rows.find((m) => m.android_sms_id === 2)?.gone_at).toBe(NOW);
    expect(rows.find((m) => m.android_sms_id === 1)?.gone_at).toBeNull();
    expect(await onPhone(db, '90000000002')).toBe(0);
    expect(await onPhone(db, '90000000001')).toBe(1);
    const kept = await db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM transactions WHERE momo_txn_id = '90000000002' AND retracted_at IS NULL",
    );
    expect(kept?.n).toBe(1);
  });

  it('treats a reused id with a different date as a new message and retires the old row', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add(pay(1, '90000000001'), pay(2, '90000000002'));
    await scanner.scan();

    sms.remove(2).add(pay(2, '90000000009', 50));
    sms.readCalls.length = 0;
    await scanner.scan();

    expect(sms.readCalls).toEqual([[2]]);
    const rows = (await messages(db)).filter((m) => m.android_sms_id === 2);
    expect(rows).toHaveLength(2);
    expect(rows.map((m) => [m.received_at, m.gone_at !== null])).toEqual([
      [T0 + 2 * HOUR, true],
      [T0 + 50 * HOUR, false],
    ]);
    expect(await onPhone(db, '90000000002')).toBe(0);
    expect(await onPhone(db, '90000000009')).toBe(1);
  });

  it('brings back a message that left and returned with the same id and date', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add(pay(1, '90000000001'));
    await scanner.scan();
    const [original] = sms.inbox;
    sms.remove(1);
    await scanner.scan();
    expect(await onPhone(db, '90000000001')).toBe(0);

    sms.add(original!);
    await scanner.scan();

    expect(await onPhone(db, '90000000001')).toBe(1);
    expect(await messages(db)).toHaveLength(1);
  });

  it('records ignored and unparsed messages with their status and reason', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add(
      { androidId: 1, body: PROMO, receivedAt: T0 },
      { androidId: 2, body: FAILED, receivedAt: T0 + HOUR },
      {
        androidId: 3,
        body: 'A new kind of message. Transaction ID: 90009999998.',
        receivedAt: T0 + 2 * HOUR,
      },
    );

    const outcome = await scanner.scan();

    expect(outcome).toMatchObject({ status: 'ok', payments: 0 });
    const rows = await messages(db);
    expect(rows.map((m) => [m.status, m.reason])).toEqual([
      ['ignored', 'no_txn_id'],
      ['ignored', 'failed'],
      ['unparsed', null],
    ]);
  });

  it('never lets an OTP body reach JS or the database', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add({ androidId: 1, body: OTP, receivedAt: T0 }, pay(2, '90000000002'));

    const read = await sms.readMessagesByIds([1]);
    expect(read).toEqual([expect.objectContaining({ body: null, isOtp: true })]);
    expect(JSON.stringify(read)).not.toContain('123456');

    await scanner.scan();

    const rows = await messages(db);
    expect(rows[0]).toMatchObject({ android_sms_id: 1, status: 'ignored', reason: 'otp' });
    const dump = JSON.stringify([
      await db.all('SELECT * FROM sms_messages'),
      await db.all('SELECT * FROM sms_fragments'),
      await db.all('SELECT * FROM transactions'),
    ]);
    expect(dump).not.toContain('123456');
    expect(dump).not.toContain('Your code');
  });

  it('does not store message bodies', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add({ androidId: 1, body: paymentFor('90000000001', '3.00', 'MTNBUNDLE'), receivedAt: T0 });
    await scanner.scan();

    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const { name } of tables) {
      const cols = await db.all<{ name: string }>(`PRAGMA table_info(${name})`);
      expect(cols.map((c) => c.name)).not.toContain('body');
    }
    const dump = JSON.stringify(await db.all('SELECT * FROM sms_messages'));
    expect(dump).not.toContain('Current Balance');
  });

  it('ignores another sender even if the native side returns it', async () => {
    const { db, sms, scanner } = await fixture();
    sms.leakOtherSenders = true;
    sms.add(
      {
        androidId: 1,
        sender: 'Bank',
        body: paymentFor('90000000001', '9.00', 'X'),
        receivedAt: T0,
      },
      pay(2, '90000000002'),
    );

    await scanner.scan();

    expect((await messages(db)).map((m) => m.android_sms_id)).toEqual([2]);
  });

  it('answers no_permission and writes nothing when SMS access is missing', async () => {
    for (const permission of ['denied', 'blocked', 'undetermined'] as const) {
      const { db, sms, scanner } = await fixture();
      sms.permission = permission;
      sms.add(pay(1, '90000000001'));

      expect(await scanner.scan()).toEqual({ status: 'no_permission', permission });

      expect(sms.listCalls).toBe(0);
      expect(await messages(db)).toEqual([]);
      expect(await getMeta(db, 'first_import_done')).toBeNull();
    }
  });

  it('answers no_messages when access is granted but the inbox has none, and is not a finished import', async () => {
    const { db, sms, scanner } = await fixture();

    expect(await scanner.scan()).toEqual({ status: 'no_messages' });

    expect(await getMeta(db, 'first_import_done')).toBeNull();
    sms.add(pay(1, '90000000001'));
    expect(await scanner.scan()).toMatchObject({ status: 'ok', read: 1 });
    expect(await getMeta(db, 'first_import_done')).toBe('1');
  });

  describe('single flight', () => {
    it('shares one scan between two concurrent calls', async () => {
      const { db, sms, scanner } = await fixture();
      sms.add(pay(1, '90000000001'));

      const [a, b] = await Promise.all([scanner.scan(), scanner.scan()]);

      expect(a).toEqual(b);
      expect(await messages(db)).toHaveLength(1);
      expect(sms.listCalls).toBeLessThanOrEqual(2);
    });

    it('runs once more when a scan is requested mid-run, and picks up a message that arrived', async () => {
      const { db, sms, scanner } = await fixture();
      sms.add(pay(1, '90000000001'));
      let release!: () => void;
      sms.holdList = new Promise<void>((r) => (release = r));

      const first = scanner.scan();
      await new Promise((r) => setTimeout(r, 0));
      sms.add(pay(2, '90000000002'));
      sms.holdList = null;
      const second = scanner.scan();
      const third = scanner.scan();
      release();
      await Promise.all([first, second, third]);

      expect(sms.listCalls).toBe(2);
      expect((await messages(db)).map((m) => m.android_sms_id)).toEqual([1, 2]);
    });
  });

  describe('a failing run', () => {
    it('stores nothing when the first read fails, and the next scan reads everything', async () => {
      const { db, sms, scanner } = await fixture();
      sms.add(pay(1, '90000000001'), pay(2, '90000000002'));
      sms.failReadOn = 1;

      expect(await scanner.scan()).toEqual({ status: 'failed' });
      expect(await messages(db)).toEqual([]);
      expect(await getMeta(db, 'first_import_done')).toBeNull();

      sms.failReadOn = null;
      expect(await scanner.scan()).toMatchObject({ status: 'ok', read: 2 });
      expect(await messages(db)).toHaveLength(2);
    });

    it('keeps the pages that committed and retries only the rest', async () => {
      const { db, sms, scanner } = await fixture();
      for (let i = 1; i <= 501; i += 1) {
        sms.add({ androidId: i, body: `${PROMO} ${i}`, receivedAt: T0 + i });
      }
      sms.failReadOn = 2;

      expect(await scanner.scan()).toEqual({ status: 'failed' });
      expect(await messages(db)).toHaveLength(500);

      sms.failReadOn = null;
      sms.readCalls.length = 0;
      expect(await scanner.scan()).toMatchObject({ status: 'ok', read: 1 });
      expect(sms.readCalls).toEqual([[501]]);
      expect(await messages(db)).toHaveLength(501);
    });

    it('answers failed when the native module is missing', async () => {
      const { sms, scanner } = await fixture();
      sms.getPermissionStatus = () => {
        throw new Error('native module not in this build');
      };
      expect(await scanner.scan()).toEqual({ status: 'failed' });
    });
  });

  it('pages unseen ids in chunks of 500', async () => {
    const { sms, scanner, progress } = await fixture();
    for (let i = 1; i <= 1_001; i += 1) {
      sms.add({ androidId: i, body: `${PROMO} ${i}`, receivedAt: T0 + i });
    }

    await scanner.scan();

    expect(sms.readCalls.map((c) => c.length)).toEqual([500, 500, 1]);
    expect(progress.map((p) => p.read)).toEqual([0, 500, 1_000, 1_001]);
  });

  it('compares ids as integers, not text', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add(pay(999, '90000000001'), pay(1_000, '90000000002'));
    await scanner.scan();
    sms.readCalls.length = 0;

    await scanner.scan();

    expect(sms.readCalls).toEqual([]);
    expect((await messages(db)).map((m) => m.android_sms_id)).toEqual([999, 1_000]);
  });

  it('links a reversal that arrives in a later scan', async () => {
    const { db, sms, scanner } = await fixture();
    sms.add(pay(1, '90000000001'));
    await scanner.scan();
    sms.add({
      androidId: 2,
      body: `Y'ello Valued Customer, the transfer of GHS 5.00 to MTNBUNDLE has been reversed on 2024-06-05 11:42:21 with transaction ID: 90000000005. Your new balance is GHS7,774.63. Transaction fee is GHS0.`,
      receivedAt: T0 + 5 * HOUR,
    });

    await scanner.scan();

    const links = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM reversal_links');
    expect(links?.n).toBe(1);
  });
});
