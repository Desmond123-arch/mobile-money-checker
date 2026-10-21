import { monthRange } from '@/domain/calendar/month';
import { addTxn, annotate, categoryId, setup } from './fixtures';
import type { Db } from '../db';
import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';
import {
  allTimeSummary,
  categorySpend,
  monthsWithData,
  yearSummary,
  yearsWithData,
} from '../queries';
import { openNodeDb } from './nodeDb';

const MAY = Date.UTC(2024, 4, 10);
const JUNE = Date.UTC(2024, 5, 3);
const NEXT_YEAR = Date.UTC(2025, 0, 5);

async function allocate(db: Db, txn: number, category: number, amount: number, spentOn = MAY) {
  return (
    await db.run(
      `INSERT INTO cash_allocations (cash_out_txn_id, category_id, amount_pesewas, spent_on,
         created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)`,
      [txn, category, amount, spentOn],
    )
  ).lastInsertRowId;
}

const cashOut = async (db: Db, over = {}) =>
  addTxn(db, {
    kind: 'cash_out',
    amount_pesewas: 10_000,
    fee_pesewas: 100,
    occurred_at: MAY,
    auto_category_id: await categoryId(db, 'cash'),
    auto_category_source: 'default',
    ...over,
  });

const byCategory = async (db: Db, id: string) => {
  const rows = await categorySpend(db, monthRange('2024-05'));
  return rows.find((r) => r.categoryId === id)?.amount ?? 0;
};

describe('migration 0002', () => {
  it('creates the table and replaces the view', async () => {
    const db = await setup();
    expect(await db.get(`SELECT 1 FROM sqlite_master WHERE name = 'cash_allocations'`)).not.toBe(
      null,
    );
    expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2]);
    await expect(migrate(db, MIGRATIONS)).resolves.toBe(2);
    const views = await db.all<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name`,
    );
    expect(views.map((v) => v.name)).toEqual([
      'ledger_lines',
      'transaction_category',
      'transaction_list',
      'unread_messages',
    ]);
  });

  it('upgrades a 0001 database with data and keeps every total', async () => {
    const db = openNodeDb();
    await migrate(db, [MIGRATIONS[0]!]);
    const food = await categoryId(db, 'misc');
    await addTxn(db, { amount_pesewas: 2_000, fee_pesewas: 50, occurred_at: MAY });
    const cash = await addTxn(db, {
      kind: 'cash_out',
      amount_pesewas: 10_000,
      occurred_at: MAY,
    });
    await annotate(db, cash, { category_id: food });
    const before = await monthsWithData(db);
    const lines = await db.all('SELECT * FROM ledger_lines ORDER BY transaction_id, part');
    await migrate(db, MIGRATIONS);
    expect(await db.get('PRAGMA user_version')).toEqual({ user_version: 2 });
    expect(await monthsWithData(db)).toEqual(before);
    expect(await db.all('SELECT * FROM ledger_lines ORDER BY transaction_id, part')).toEqual(lines);
    expect(await yearsWithData(db)).toHaveLength(1);
  });
});

describe('cash_allocations rules', () => {
  it('accepts a cash-out and rejects anything else, even with foreign keys off', async () => {
    const db = await setup();
    await db.exec('PRAGMA foreign_keys = OFF');
    const misc = await categoryId(db, 'misc');
    const payment = await addTxn(db, { amount_pesewas: 5_000 });
    const income = await addTxn(db, { flow: 'income', kind: 'cash_out' });
    const manual = await addTxn(db, { origin: 'manual', kind: 'cash_out' });
    for (const id of [payment, income, manual, 9_999]) {
      await expect(allocate(db, id, misc, 100)).rejects.toThrow(/belongs to a cash-out|exceed/);
    }
    const cash = await cashOut(db);
    await expect(allocate(db, cash, misc, 100)).resolves.toBeGreaterThan(0);
    const other = await addTxn(db, { amount_pesewas: 5_000 });
    await expect(
      db.run('UPDATE cash_allocations SET cash_out_txn_id = ?', [other]),
    ).rejects.toThrow(/belongs to a cash-out|exceed/);
  });

  it('never lets the allocations exceed the cash-out, on insert or update', async () => {
    const db = await setup();
    await db.exec('PRAGMA foreign_keys = OFF');
    const misc = await categoryId(db, 'misc');
    const cash = await cashOut(db);
    const a = await allocate(db, cash, misc, 6_000);
    await expect(allocate(db, cash, misc, 4_001)).rejects.toThrow(/exceed/);
    const b = await allocate(db, cash, misc, 4_000);
    await expect(
      db.run('UPDATE cash_allocations SET amount_pesewas = 6_001 WHERE id = ?', [a]),
    ).rejects.toThrow(/exceed/);
    await db.run('UPDATE cash_allocations SET amount_pesewas = 5_000 WHERE id = ?', [a]);
    await db.run('DELETE FROM cash_allocations WHERE id = ?', [b]);
    await db.run('UPDATE cash_allocations SET amount_pesewas = 10_000 WHERE id = ?', [a]);
  });

  it('checks amount, note and the category reference', async () => {
    const db = await setup();
    const misc = await categoryId(db, 'misc');
    const cash = await cashOut(db);
    await expect(allocate(db, cash, misc, 0)).rejects.toThrow(/CHECK/);
    await expect(allocate(db, cash, misc, 10.5)).rejects.toThrow();
    await expect(
      db.run(
        `INSERT INTO cash_allocations (cash_out_txn_id, category_id, amount_pesewas, note, spent_on,
           created_at, updated_at) VALUES (?, ?, 100, ' x ', 1, 1, 1)`,
        [cash, misc],
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.run(
        `INSERT INTO cash_allocations (cash_out_txn_id, category_id, amount_pesewas, note, spent_on,
           created_at, updated_at) VALUES (?, ?, 100, '', 1, 1, 1)`,
        [cash, misc],
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(allocate(db, cash, 9_999, 100)).rejects.toThrow(/FOREIGN KEY/);
    const used = await categoryId(db, 'food');
    await allocate(db, cash, used, 100);
    await expect(db.run('DELETE FROM categories WHERE id = ?', [used])).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('hides the allocations of a retracted cash-out', async () => {
    const db = await setup();
    const misc = await categoryId(db, 'misc');
    const cash = await cashOut(db);
    await allocate(db, cash, misc, 100);
    await db.run('UPDATE transactions SET retracted_at = 5 WHERE id = ?', [cash]);
    expect(await db.get('SELECT 1 FROM ledger_lines WHERE transaction_id = ?', [cash])).toBe(null);
  });
});

describe('ledger_lines with allocations', () => {
  it('moves money between categories and never changes a total', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const transport = await categoryId(db, 'transport');
    const cash = await cashOut(db);
    const total = (await monthsWithData(db))[0]!.spent;
    expect(total).toBe(10_100);
    expect(await byCategory(db, 'cash')).toBe(10_100);

    await allocate(db, cash, food, 3_000);
    await allocate(db, cash, transport, 2_000, JUNE);
    expect((await monthsWithData(db))[0]!.spent).toBe(total);
    expect(await byCategory(db, 'food')).toBe(3_000);
    expect(await byCategory(db, 'transport')).toBe(2_000);
    expect(await byCategory(db, 'cash')).toBe(5_100);
  });

  it('counts the money at the cash-out date, whatever the spent date says', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const cash = await cashOut(db);
    await allocate(db, cash, food, 4_000, JUNE);
    const months = await monthsWithData(db);
    expect(months.map((m) => m.monthId)).toEqual(['2024-05']);
    expect(await categorySpend(db, monthRange('2024-06'))).toEqual([]);
  });

  it('drops the remainder line when everything is allocated and leaves the charge', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const cash = await cashOut(db);
    await allocate(db, cash, food, 10_000);
    const lines = await db.all<{ category_id: number; part: string; pesewas: number }>(
      'SELECT category_id, part, pesewas FROM ledger_lines WHERE transaction_id = ? ORDER BY part',
      [cash],
    );
    expect(lines).toEqual([
      { category_id: food, part: 'amount', pesewas: 10_000 },
      { category_id: await categoryId(db, 'cash'), part: 'charge', pesewas: 100 },
    ]);
  });

  it('puts the remainder in the answered category and keeps a plain answer working', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const rent = await categoryId(db, 'rent');
    const cash = await cashOut(db);
    await annotate(db, cash, { category_id: rent });
    expect(await byCategory(db, 'rent')).toBe(10_100);
    await allocate(db, cash, food, 2_500);
    expect(await byCategory(db, 'rent')).toBe(7_600);
    expect(await byCategory(db, 'food')).toBe(2_500);
  });

  it('keeps a refunded cash-out netting the same total', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const cash = await cashOut(db, { fee_pesewas: 0 });
    await allocate(db, cash, food, 1_000);
    const credit = await addTxn(db, {
      flow: 'credit',
      kind: 'reversal',
      amount_pesewas: 10_000,
      occurred_at: MAY + 1,
    });
    await db.run(
      `INSERT INTO reversal_links (credit_txn_id, original_txn_id, linked_by, confidence, created_at)
       VALUES (?, ?, 'auto', 'exact', 1)`,
      [credit, cash],
    );
    expect((await monthsWithData(db))[0]!.spent).toBe(0);
  });

  it('clamps when the cash-out shrank below its allocations', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const cash = await cashOut(db);
    await allocate(db, cash, food, 9_000);
    await db.run('UPDATE transactions SET amount_pesewas = 5_000 WHERE id = ?', [cash]);
    const rows = await db.all<{ pesewas: number }>(
      `SELECT pesewas FROM ledger_lines WHERE transaction_id = ? AND part = 'amount'`,
      [cash],
    );
    expect(rows.every((r) => r.pesewas >= 0)).toBe(true);
  });

  it('keeps year totals equal to the sum of months and all time to the sum of years', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const transport = await categoryId(db, 'transport');
    const a = await cashOut(db);
    const b = await cashOut(db, { occurred_at: JUNE, amount_pesewas: 8_000 });
    const c = await cashOut(db, { occurred_at: NEXT_YEAR, amount_pesewas: 3_000 });
    await addTxn(db, { amount_pesewas: 700, occurred_at: JUNE });
    const plain = await monthsWithData(db);

    await allocate(db, a, food, 4_000, JUNE);
    await allocate(db, b, transport, 8_000);
    await allocate(db, c, food, 1_000);
    expect(await monthsWithData(db)).toEqual(plain);

    const months = await monthsWithData(db);
    const sumOf = (year: string) =>
      months.filter((m) => m.monthId.startsWith(year)).reduce((s, m) => s + m.spent, 0);
    const y2024 = await yearSummary(db, 2024);
    const y2025 = await yearSummary(db, 2025);
    expect(y2024.spent).toBe(sumOf('2024'));
    expect(y2025.spent).toBe(sumOf('2025'));
    const all = await allTimeSummary(db);
    expect(all.spent).toBe(y2024.spent + y2025.spent);
  });
});
