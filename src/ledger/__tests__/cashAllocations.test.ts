import { addTxn, categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { categoryImpact, categorySpend, monthsWithData } from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import { addAllocation, deleteAllocation, updateAllocation } from '../cashAllocations';
import { createCategory, deleteCategory } from '../categories';
import { createFileDb } from './fileDb';

const DAY = 86_400_000;
const OUT = Date.UTC(2024, 4, 10, 15);
const NOW = Date.UTC(2024, 4, 12, 9);
const MAY = monthRange('2024-05');

const cashOut = async (db: Db, over = {}) =>
  addTxn(db, {
    kind: 'cash_out',
    amount_pesewas: 10_000,
    fee_pesewas: 100,
    occurred_at: OUT,
    auto_category_id: await categoryId(db, 'cash'),
    auto_category_source: 'default',
    ...over,
  });

const entry = (over = {}) => ({ categoryId: 'food', amount: 3_000, spentOn: OUT, ...over });
const spend = async (db: Db, id: string) =>
  (await categorySpend(db, MAY)).find((r) => r.categoryId === id)?.amount ?? 0;

let db: Db;
beforeEach(async () => {
  db = await setup();
});

describe('addAllocation', () => {
  it('stores an entry with a trimmed note and the date it was spent', async () => {
    const cash = await cashOut(db);
    const res = await addAllocation(db, cash, entry({ note: '  bread ', spentOn: NOW }), NOW);
    expect(res).toEqual({ ok: true, id: expect.any(Number) });
    expect(await db.get('SELECT * FROM cash_allocations')).toMatchObject({
      cash_out_txn_id: cash,
      category_id: await categoryId(db, 'food'),
      amount_pesewas: 3_000,
      note: 'bread',
      spent_on: NOW,
      created_at: NOW,
      updated_at: NOW,
    });
  });

  it('stores a blank note as NULL', async () => {
    const cash = await cashOut(db);
    await addAllocation(db, cash, entry({ note: '   ' }), NOW);
    expect(await db.get('SELECT note FROM cash_allocations')).toEqual({ note: null });
  });

  it('refuses with the words the form shows, and writes nothing', async () => {
    const cash = await cashOut(db);
    const refuse = async (over: object) => {
      const r = await addAllocation(db, cash, entry(over), NOW);
      return r.ok ? null : r.message;
    };
    expect(await refuse({ amount: 0 })).toBe('Amount must be more than 0.');
    expect(await refuse({ categoryId: 'nope' })).toBe('Pick a category.');
    expect(await refuse({ categoryId: 'income' })).toBe('Pick a category.');
    expect(await refuse({ amount: 10_001 })).toBe('That is more than what is left (GHS 100.00).');
    expect(await refuse({ spentOn: OUT - DAY })).toBe('Pick a day on or after the withdrawal.');
    expect(await refuse({ spentOn: NOW + DAY })).toBe('That day has not come yet.');
    expect(await db.get('SELECT COUNT(*) AS n FROM cash_allocations')).toEqual({ n: 0 });
  });

  it('counts what earlier entries took', async () => {
    const cash = await cashOut(db);
    await addAllocation(db, cash, entry({ amount: 7_000 }), NOW);
    expect(await addAllocation(db, cash, entry({ amount: 3_001 }), NOW)).toEqual({
      ok: false,
      message: 'That is more than what is left (GHS 30.00).',
    });
    expect((await addAllocation(db, cash, entry({ amount: 3_000 }), NOW)).ok).toBe(true);
    expect(await addAllocation(db, cash, entry({ amount: 1 }), NOW)).toEqual({
      ok: false,
      message: 'Nothing is left to break down.',
    });
  });

  it('throws for something that is not a live cash-out', async () => {
    const payment = await addTxn(db, { amount_pesewas: 5_000, occurred_at: OUT });
    await expect(addAllocation(db, payment, entry(), NOW)).rejects.toThrow(/no cash-out/);
    await expect(addAllocation(db, 9_999, entry(), NOW)).rejects.toThrow(/no cash-out/);
    const gone = await cashOut(db, { retracted_at: 5 });
    await expect(addAllocation(db, gone, entry(), NOW)).rejects.toThrow(/no cash-out/);
  });
});

describe('updateAllocation', () => {
  it('gives the old amount back before checking the new one', async () => {
    const cash = await cashOut(db);
    const a = await addAllocation(db, cash, entry({ amount: 6_000 }), NOW);
    await addAllocation(db, cash, entry({ amount: 3_000 }), NOW);
    const id = a.ok ? a.id : 0;
    expect((await updateAllocation(db, id, entry({ amount: 7_000 }), NOW)).ok).toBe(true);
    expect(await updateAllocation(db, id, entry({ amount: 7_001 }), NOW)).toEqual({
      ok: false,
      message: 'That is more than what is left (GHS 70.00).',
    });
  });

  it('changes category, note and date, and shifts the category spend', async () => {
    const cash = await cashOut(db);
    const a = await addAllocation(db, cash, entry({ note: 'x' }), NOW);
    const id = a.ok ? a.id : 0;
    expect(await spend(db, 'food')).toBe(3_000);
    await updateAllocation(
      db,
      id,
      entry({ categoryId: 'transport', amount: 2_000, note: '', spentOn: NOW }),
      NOW + 5,
    );
    expect(await spend(db, 'food')).toBe(0);
    expect(await spend(db, 'transport')).toBe(2_000);
    expect(await db.get('SELECT note, spent_on, updated_at FROM cash_allocations')).toEqual({
      note: null,
      spent_on: NOW,
      updated_at: NOW + 5,
    });
  });

  it('refuses a bad edit and throws for a missing entry', async () => {
    const cash = await cashOut(db);
    const a = await addAllocation(db, cash, entry(), NOW);
    const id = a.ok ? a.id : 0;
    expect(await updateAllocation(db, id, entry({ amount: 0 }), NOW)).toEqual({
      ok: false,
      message: 'Amount must be more than 0.',
    });
    expect(await db.get('SELECT amount_pesewas AS a FROM cash_allocations')).toEqual({ a: 3_000 });
    await expect(updateAllocation(db, 9_999, entry(), NOW)).rejects.toThrow(/no allocation/);
  });
});

describe('deleteAllocation', () => {
  it('returns the amount to what is left and is safe to repeat', async () => {
    const cash = await cashOut(db);
    const a = await addAllocation(db, cash, entry({ amount: 10_000 }), NOW);
    const id = a.ok ? a.id : 0;
    await deleteAllocation(db, id);
    await deleteAllocation(db, id);
    expect(await spend(db, 'cash')).toBe(10_100);
    expect((await addAllocation(db, cash, entry({ amount: 10_000 }), NOW)).ok).toBe(true);
  });
});

describe('deleteCategory with allocations', () => {
  it('moves them to Misc and counts them first', async () => {
    const cash = await cashOut(db);
    const made = await createCategory(db, { name: 'Church', color: '#EB6834' }, NOW);
    if (!made.ok) throw new Error('create failed');
    await addAllocation(db, cash, entry({ categoryId: made.id }), NOW);
    await addAllocation(db, cash, entry({ categoryId: made.id, amount: 500 }), NOW);
    expect(await categoryImpact(db, made.id)).toMatchObject({ allocations: 2, transactions: 0 });
    const total = (await monthsWithData(db))[0]!.spent;

    await deleteCategory(db, made.id);

    expect(await spend(db, 'other')).toBe(3_500);
    expect((await monthsWithData(db))[0]!.spent).toBe(total);
  });
});

describe('after a restart', () => {
  it('keeps an added, edited and deleted entry', async () => {
    const file = await createFileDb();
    try {
      const cash = await cashOut(file.db);
      const a = await addAllocation(file.db, cash, entry({ note: 'bread' }), NOW);
      const b = await addAllocation(file.db, cash, entry({ amount: 1_000 }), NOW);
      await updateAllocation(
        file.db,
        a.ok ? a.id : 0,
        entry({ amount: 4_000, note: 'bread+' }),
        NOW,
      );
      await deleteAllocation(file.db, b.ok ? b.id : 0);

      const reopened = file.reopen();
      expect(await reopened.all('SELECT amount_pesewas, note FROM cash_allocations')).toEqual([
        { amount_pesewas: 4_000, note: 'bread+' },
      ]);
      expect(await spend(reopened, 'food')).toBe(4_000);
      expect(await spend(reopened, 'cash')).toBe(6_100);
    } finally {
      file.dispose();
    }
  });
});
