import { setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { finishImport } from '../finishImport';
import { importSummary } from '../importSummary';
import { ingest } from '../ingest';
import {
  BATCH,
  HAND_SPEND,
  HOUR,
  T0,
  dump,
  item,
  merchantPaid,
  paymentCompleted,
  paymentFor,
} from './synthetic';

const NOW = 5_000_000;
let db: Db;
beforeEach(async () => {
  db = await setup();
});

const spendTotal = async () =>
  (await db.get<{ t: number }>(
    `SELECT SUM(pesewas) AS t FROM ledger_lines WHERE bucket = 'spend'`,
  ))!.t;

describe('ingest counts', () => {
  it('counts parsed, ignored and unparsed, and stores only parsed backup messages', async () => {
    const r = await ingest(db, BATCH, NOW);
    expect(r).toMatchObject({
      parsed: 5,
      ignored: 3,
      unparsed: 1,
      errors: 0,
      transactions: 5,
      payments: 3,
    });
    const stored = await db.get<{ n: number; bad: number }>(
      `SELECT COUNT(*) AS n, SUM(status <> 'parsed' OR source <> 'backup') AS bad FROM sms_messages`,
    );
    expect(stored).toEqual({ n: 5, bad: 0 });
  });

  it('keeps the schema key shape for backup messages', async () => {
    await ingest(db, BATCH.slice(0, 1), NOW);
    const row = await db.get<{ backup_key: string }>('SELECT backup_key FROM sms_messages');
    expect(row!.backup_key).toMatch(/^\d+:90000000001:[a-z_]+$/);
  });
});

describe('ingest convergence', () => {
  it('is idempotent: the same batch twice gives identical rows', async () => {
    await ingest(db, BATCH, NOW);
    const once = await dump(db);
    const again = await ingest(db, BATCH, NOW);
    expect(await dump(db)).toEqual(once);
    expect(again.parsed).toBe(5);
  });

  it('is order independent: a batch and its reverse give identical transactions', async () => {
    const other = await setup();
    await ingest(db, BATCH, NOW);
    await ingest(other, [...BATCH].reverse(), NOW);
    // The surrogate id follows insertion order by design; every other column must match.
    const rows = (d: Db) =>
      d.all(
        `SELECT origin, momo_txn_id, flow, kind, amount_pesewas, fee_pesewas, tax_pesewas,
           balance_after_pesewas, counterparty_name, merchant_code, counterparty_number, sms_reference,
           auto_category_id, auto_category_source, has_conflict, occurred_at, occurred_at_source,
           retracted_at, created_at, updated_at FROM transactions ORDER BY momo_txn_id`,
      );
    expect(await rows(other)).toEqual(await rows(db));
  });

  it('merges a pair: the real name beats "Merchant NNN" in either order and either batch split', async () => {
    const a = item(merchantPaid('90000000010', '10', '090000'), T0);
    const b = item(paymentCompleted('90000000010', '10.00', 'KESABA STORES'), T0 + 60_000);
    for (const batches of [[[a, b]], [[b, a]], [[a], [b]], [[b], [a]]]) {
      const fresh = await setup();
      for (const batch of batches) await ingest(fresh, batch, NOW);
      const row = await fresh.get<Record<string, unknown>>(
        `SELECT counterparty_name, merchant_code, flow, has_conflict FROM transactions`,
      );
      expect(row).toEqual({
        counterparty_name: 'KESABA STORES',
        merchant_code: '090000',
        flow: 'spend',
        has_conflict: 0,
      });
      expect(await fresh.get('SELECT COUNT(*) AS n FROM sms_fragments')).toEqual({ n: 2 });
    }
  });

  it('counts a payment split across batches in each batch result so callers can dedupe by id', async () => {
    const a = await ingest(db, [item(merchantPaid('90000000010', '10', '090000'), T0)], NOW);
    const b = await ingest(
      db,
      [item(paymentCompleted('90000000010', '10.00', 'KESABA STORES'), T0 + 1)],
      NOW,
    );
    expect([...a.paymentIds]).toEqual([...b.paymentIds]);
  });
});

describe('ingest faults', () => {
  it('a poison message rolls back to its savepoint and does not block the batch', async () => {
    await db.exec(`CREATE TRIGGER poison BEFORE INSERT ON transactions
      WHEN NEW.amount_pesewas = 777700 BEGIN SELECT RAISE(ABORT, 'poison'); END`);
    const batch = [
      item(paymentFor('90000000021', '1.00', 'Before'), T0),
      item(paymentFor('90000000022', '7777.00', 'Poison'), T0 + HOUR),
      item(paymentFor('90000000023', '2.00', 'After'), T0 + 2 * HOUR),
    ];
    const r = await ingest(db, batch, NOW);
    expect(r).toMatchObject({ parsed: 2, errors: 1, transactions: 2, payments: 2 });
    const ids = await db.all<{ momo_txn_id: string }>(
      'SELECT momo_txn_id FROM transactions ORDER BY momo_txn_id',
    );
    expect(ids.map((x) => x.momo_txn_id)).toEqual(['90000000021', '90000000023']);
    expect(await db.get('SELECT COUNT(*) AS n FROM sms_messages')).toEqual({ n: 2 });
    expect(await db.get('SELECT COUNT(*) AS n FROM sms_fragments')).toEqual({ n: 2 });
  });
});

describe('ledger totals and reversals', () => {
  it('links the reversal to its payment and spend equals the hand-computed total', async () => {
    await ingest(db, BATCH, NOW);
    expect(await finishImport(db, NOW)).toEqual({ linked: 1 });
    const link = await db.get<{ linked_by: string; confidence: string; orig: string }>(
      `SELECT l.linked_by, l.confidence, o.momo_txn_id AS orig FROM reversal_links l
       JOIN transactions o ON o.id = l.original_txn_id`,
    );
    expect(link).toEqual({ linked_by: 'auto', confidence: 'exact', orig: '90000000001' });
    expect(await spendTotal()).toBe(HAND_SPEND);
    const summary = await importSummary(db);
    expect(summary).toEqual({
      transactions: 5,
      payments: 3,
      latestMonth: '2024-06',
      monthSpendPesewas: HAND_SPEND,
    });
  });

  it('finishImport is idempotent and sets the meta keys once', async () => {
    await ingest(db, BATCH, NOW);
    await finishImport(db, NOW);
    const before = await db.all('SELECT * FROM meta ORDER BY key');
    expect(await finishImport(db, NOW + 99)).toEqual({ linked: 0 });
    expect(await db.all('SELECT * FROM meta ORDER BY key')).toEqual(before);
    expect(await db.all('SELECT * FROM reversal_links')).toHaveLength(1);
    const meta = Object.fromEntries(before.map((r: any) => [r.key, r.value]));
    expect(meta).toMatchObject({
      first_import_done: '1',
      first_import_at: String(NOW),
      parser_version: '1',
    });
  });

  it('applies the category stub: cash out is cash, incoming is income, the rest misc', async () => {
    await ingest(db, BATCH, NOW);
    const rows = await db.all<{ momo_txn_id: string; key: string; source: string }>(
      `SELECT t.momo_txn_id, c.system_key AS key, t.auto_category_source AS source
       FROM transactions t JOIN categories c ON c.id = t.auto_category_id ORDER BY t.momo_txn_id`,
    );
    expect(rows.map((r) => r.key)).toEqual(['misc', 'cash', 'misc', 'income', 'misc']);
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(['default']));
  });
});

describe('user data and sources', () => {
  it('a user annotation survives a re-ingest', async () => {
    await ingest(db, BATCH, NOW);
    const t = await db.get<{ id: number }>(
      `SELECT id FROM transactions WHERE momo_txn_id = '90000000003'`,
    );
    const food = (await db.get<{ id: number }>(
      `SELECT id FROM categories WHERE system_key = 'family'`,
    ))!;
    await db.run(
      `INSERT INTO transaction_annotations (transaction_id, category_id, note, updated_at) VALUES (?, ?, 'lunch', 1)`,
      [t!.id, food.id],
    );
    await ingest(db, BATCH, NOW + 1);
    expect(await db.all('SELECT category_id, note FROM transaction_annotations')).toEqual([
      { category_id: food.id, note: 'lunch' },
    ]);
    const view = await db.get<{ category_id: number; note: string }>(
      'SELECT category_id, note FROM transaction_list WHERE id = ?',
      [t!.id],
    );
    expect(view).toEqual({ category_id: food.id, note: 'lunch' });
  });

  it('source_on_phone is false for backup-only transactions and true once an inbox copy joins', async () => {
    await ingest(db, BATCH, NOW);
    const flags = () =>
      db.all<{ source_on_phone: number }>(
        'SELECT source_on_phone FROM transaction_list WHERE momo_txn_id = ?',
        ['90000000003'],
      );
    expect(await flags()).toEqual([{ source_on_phone: 0 }]);
    await ingest(db, [item(BATCH[2]!.body, BATCH[2]!.receivedAt, 'inbox')], NOW);
    expect(await flags()).toEqual([{ source_on_phone: 1 }]);
    expect(await db.get('SELECT COUNT(*) AS n FROM transactions')).toEqual({ n: 5 });
  });

  it('records an inbox message that stops parsing and drops its fragment', async () => {
    const m = item(paymentFor('90000000031', '4.00', 'Shop'), T0, 'inbox');
    await ingest(db, [m], NOW);
    expect(await db.get('SELECT COUNT(*) AS n FROM sms_fragments')).toEqual({ n: 1 });
    await ingest(db, [{ ...m, body: 'garbage with no id' }], NOW + 1);
    expect(await db.get('SELECT COUNT(*) AS n FROM sms_fragments')).toEqual({ n: 0 });
    const t = await db.get<{ retracted_at: number }>('SELECT retracted_at FROM transactions');
    expect(t!.retracted_at).toBe(NOW + 1);
  });
});
