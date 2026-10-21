import { addTxn, categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import {
  categorySpend,
  listTransactions,
  monthSummary,
  recentPayments,
  transactionDetail,
} from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import { pesewas } from '@/domain/money';
import { addManualExpense } from '../manualExpense';
import { createFileDb } from './fileDb';

const at = (day: number, hour = 12) => Date.UTC(2026, 9, day, hour);
const OCT = monthRange('2026-10');
const TODAY = new Date('2026-10-20T15:00:00Z');

let db: Db;
beforeEach(async () => {
  db = await setup();
});

describe('addManualExpense', () => {
  it('stores a manual spend row with a category annotation', async () => {
    const id = await addManualExpense(
      db,
      { name: ' Kenkey and fish ', amount: pesewas(1250), categoryId: 'food', occurredAt: at(19) },
      99,
    );
    expect(await db.get('SELECT * FROM transactions WHERE id = ?', [id])).toMatchObject({
      origin: 'manual',
      momo_txn_id: null,
      flow: 'spend',
      kind: 'manual',
      amount_pesewas: 1250,
      counterparty_name: 'Kenkey and fish',
      occurred_at_source: 'user',
      auto_category_id: null,
      auto_category_source: null,
      created_at: 99,
    });
    expect(
      await db.get('SELECT category_id FROM transaction_annotations WHERE transaction_id = ?', [
        id,
      ]),
    ).toEqual({ category_id: await categoryId(db, 'food') });
  });

  it('counts in the month total, payments, category split, list and recent', async () => {
    const food = await categoryId(db, 'food');
    await addTxn(db, {
      amount_pesewas: 4000,
      occurred_at: at(5),
      auto_category_id: food,
      auto_category_source: 'keyword',
    });
    const before = await monthSummary(db, '2026-10', '2026-10-20', 0);
    await addManualExpense(db, {
      name: 'Waakye',
      amount: pesewas(1500),
      categoryId: 'food',
      occurredAt: at(19),
    });
    await addManualExpense(db, {
      name: 'Gift',
      amount: pesewas(2500),
      categoryId: 'other',
      occurredAt: at(18),
    });

    const after = await monthSummary(db, '2026-10', '2026-10-20', 0);
    expect(after.spent - before.spent).toBe(4000);
    expect(after.payments - before.payments).toBe(2);

    const spend = await categorySpend(db, OCT);
    expect(spend).toEqual([
      { categoryId: 'food', amount: 5500 },
      { categoryId: 'other', amount: 2500 },
    ]);

    const recent = await recentPayments(db, OCT, 3);
    expect(recent.map((r) => r.row.counterparty)).toEqual(['Waakye', 'Gift', 'MoMo payment']);
    expect(recent[0]!.row).toMatchObject({ manual: true, categoryId: 'food', direction: 'out' });
    const all = await listTransactions(db, { range: OCT, categoryId: 'other' });
    expect(all.map((r) => r.row.counterparty)).toEqual(['Gift']);
  });

  it('shows a manual row through the detail query', async () => {
    const id = await addManualExpense(db, {
      name: 'Tailor',
      amount: pesewas(3000),
      categoryId: 'services',
      occurredAt: at(19),
    });
    expect(await transactionDetail(db, id, TODAY)).toMatchObject({
      counterparty: 'Tailor',
      categoryId: 'services',
      kindLabel: 'Added by you.',
      balanceAfter: null,
    });
  });

  it('rejects an empty name, a non-positive amount and an unknown category', async () => {
    const base = { name: 'x', amount: pesewas(100), categoryId: 'food', occurredAt: at(1) };
    await expect(addManualExpense(db, { ...base, name: '  ' })).rejects.toThrow();
    await expect(addManualExpense(db, { ...base, amount: pesewas(0) })).rejects.toThrow();
    await expect(addManualExpense(db, { ...base, categoryId: 'nope' })).rejects.toThrow();
    expect(await db.get('SELECT COUNT(*) AS n FROM transactions')).toEqual({ n: 0 });
  });

  it('survives closing and reopening the database', async () => {
    const file = await createFileDb();
    try {
      await addManualExpense(file.db, {
        name: 'Waakye',
        amount: pesewas(1500),
        categoryId: 'food',
        occurredAt: at(19),
      });
      const again = file.reopen();
      const rows = await listTransactions(again, { range: OCT });
      expect(rows.map((r) => [r.row.counterparty, r.row.categoryId, r.row.amount])).toEqual([
        ['Waakye', 'food', 1500],
      ]);
    } finally {
      file.dispose();
    }
  });
});
