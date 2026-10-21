import type { Db } from '../db';
import { setMeta } from '../meta';
import {
  categorySpend,
  daySpend,
  listCategories,
  listTransactions,
  monthSummary,
  monthlyFlows,
  monthsWithData,
  needsNoteCount,
  needsNoteList,
  paymentCount,
  recentPayments,
  transactionDetail,
  weekdayAverage,
} from '../queries';
import { dayRange, monthRange } from '@/domain/calendar/month';
import { addLink, addTxn, annotate, categoryId, setup } from './fixtures';

const at = (month: number, day: number, hour = 12) => Date.UTC(2026, month - 1, day, hour);
const TODAY = new Date('2026-10-20T15:00:00Z');
const TODAY_ISO = '2026-10-20';
const OCT = monthRange('2026-10');

interface Ids {
  pharmacy: number;
  cash: number;
  needsNote: number;
  salary: number;
  tagged: number;
  lunch: number;
  refund: number;
}

async function seedLedger(db: Db): Promise<Ids> {
  const food = await categoryId(db, 'food');
  const cash = await categoryId(db, 'cash');
  const income = await categoryId(db, 'income');
  const auto = (id: number) => ({ auto_category_id: id, auto_category_source: 'keyword' });

  // September: 100.00 on the 5th, 50.00 on the 25th (after the 20th, so outside the like-for-like span).
  await addTxn(db, { amount_pesewas: 10000, occurred_at: at(9, 5), ...auto(food) });
  await addTxn(db, { amount_pesewas: 5000, occurred_at: at(9, 25), ...auto(food) });
  await addTxn(db, {
    flow: 'income',
    kind: 'payment_in',
    amount_pesewas: 7000,
    occurred_at: at(9, 6),
    ...auto(income),
  });

  const pharmacy = await addTxn(db, {
    counterparty_name: 'Kojo Pharmacy',
    reference_clean: 'paracetamol',
    amount_pesewas: 2400,
    fee_pesewas: 16,
    balance_after_pesewas: 41184,
    occurred_at: at(10, 3),
    ...auto(food),
  });
  const cashOut = await addTxn(db, {
    kind: 'cash_out',
    counterparty_name: 'Balomi Ventures',
    amount_pesewas: 26000,
    occurred_at: at(10, 9),
    occurred_at_source: 'received',
    ...auto(cash),
  });
  const needsNote = await addTxn(db, {
    counterparty_name: 'Circle Mart',
    amount_pesewas: 3200,
    occurred_at: at(10, 19, 10),
  });
  const salary = await addTxn(db, {
    flow: 'income',
    kind: 'payment_in',
    counterparty_name: 'Abena Boateng',
    amount_pesewas: 10000,
    occurred_at: at(10, 19, 11),
    ...auto(income),
  });
  const tagged = await addTxn(db, {
    counterparty_name: 'Auntie Ama',
    amount_pesewas: 4500,
    occurred_at: at(10, 20, 9),
  });
  await annotate(db, tagged, { category_id: food, note: 'rice' });
  const lunch = await addTxn(db, {
    origin: 'manual',
    counterparty_name: 'Lunch',
    amount_pesewas: 1200,
    occurred_at: at(10, 18),
  });
  await annotate(db, lunch, { category_id: food });
  const refund = await addTxn(db, {
    flow: 'credit',
    kind: 'refund',
    amount_pesewas: 1000,
    occurred_at: at(10, 4),
    ...auto(food),
  });
  await addLink(db, refund, pharmacy);
  await addTxn(db, { amount_pesewas: 99999, occurred_at: at(10, 5), retracted_at: 1 });

  await setMeta(db, 'first_import_at', String(at(10, 10)));
  return { pharmacy, cash: cashOut, needsNote, salary, tagged, lunch, refund };
}

describe('read queries', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  let ids: Ids;

  beforeAll(async () => {
    db = await setup();
    ids = await seedLedger(db);
  });
  afterAll(() => db.close());

  it('lists the categories with UI ids', async () => {
    const list = await listCategories(db);
    const byId = new Map(list.map((c) => [c.id, c.name]));
    expect(byId.get('food')).toBe('Food');
    expect(byId.get('other')).toBe('Misc');
    expect(byId.get('cash')).toBe('Cash');
    expect(byId.has('misc')).toBe(false);

    await db.run(
      `INSERT INTO categories (name, color, tint, sort_order, created_at, updated_at)
       VALUES ('Pets', '#112233', '#EEEEEE', 5, 1, 1)`,
    );
    const pets = (await listCategories(db)).find((c) => c.name === 'Pets');
    expect(pets?.id).toMatch(/^\d+$/);
    await db.run(`DELETE FROM categories WHERE name = 'Pets'`);
  });

  it('finds the months with data and their totals', async () => {
    expect(await monthsWithData(db)).toEqual([
      { monthId: '2026-09', spent: 15000, moneyIn: 7000 },
      { monthId: '2026-10', spent: 36316, moneyIn: 10000 },
    ]);
  });

  it('summarises a month and compares it with the same stretch of the one before', async () => {
    const now = at(10, 20, 15);
    const s = await monthSummary(db, '2026-10', TODAY_ISO, now);
    expect(s).toMatchObject({
      label: 'October 2026',
      spent: 36316,
      moneyIn: 10000,
      payments: 5,
      needNote: 1,
      today: 20,
      daysInMonth: 31,
      deltaLabel: '263% more',
      deltaCompare: 'than this time in September',
      peakLabel: 'Fri 9 Oct, GHS 260.00',
    });
    expect(s.daily[2]).toBe(1416);
    expect(s.daily[8]).toBe(26000);
    expect(s.daily[19]).toBe(4500);
    expect(s.daily.reduce((a, b) => a + b, 0)).toBe(36316);

    const sep = await monthSummary(db, '2026-09', TODAY_ISO, now);
    expect(sep).toMatchObject({
      spent: 15000,
      today: 30,
      payments: 2,
      needNote: 0,
      deltaLabel: 'First month',
    });
  });

  it('spends the whole of the month before when the month is finished', async () => {
    await addTxn(db, { origin: 'manual', amount_pesewas: 20000, occurred_at: at(11, 2) });
    const nov = await monthSummary(db, '2026-11', '2026-12-01', at(12, 1));
    expect(nov).toMatchObject({ spent: 20000, deltaLabel: '45% less' });
    await db.run('DELETE FROM transactions WHERE occurred_at = ?', [at(11, 2)]);
  });

  it('gives an empty month zeroes', async () => {
    const empty = await monthSummary(db, '2026-07', TODAY_ISO, 0);
    expect(empty).toMatchObject({ spent: 0, moneyIn: 0, payments: 0, peakLabel: null });
  });

  it('spends by effective category, netting refunds and honouring tags', async () => {
    expect(await categorySpend(db, OCT)).toEqual([
      { categoryId: 'cash', amount: 26000 },
      { categoryId: 'food', amount: 1416 + 4500 + 1200 },
      { categoryId: 'other', amount: 3200 },
    ]);
    expect(await categorySpend(db, dayRange('2026-10-20'))).toEqual([
      { categoryId: 'food', amount: 4500 },
    ]);
    expect(await categorySpend(db, dayRange('2026-10-21'))).toEqual([]);
  });

  it('counts payments and lists the latest ones', async () => {
    expect(await paymentCount(db, OCT)).toBe(5);
    const recent = await recentPayments(db, OCT, 3);
    expect(recent.map((r) => r.row.counterparty)).toEqual(['Auntie Ama', 'Circle Mart', 'Lunch']);
    expect(recent[0]?.iso).toBe('2026-10-20');
    expect(recent[2]?.row.manual).toBe(true);
  });

  it('lists a month newest first, with direction, category and search filters', async () => {
    const all = await listTransactions(db, { range: OCT });
    expect(all.map((r) => r.row.id)).toEqual(
      [ids.tagged, ids.salary, ids.needsNote, ids.lunch, ids.cash, ids.refund, ids.pharmacy].map(
        String,
      ),
    );
    const circle = all.find((r) => r.row.id === String(ids.needsNote))!.row;
    expect(circle).toMatchObject({
      categoryId: 'other',
      note: null,
      direction: 'out',
      amount: 3200,
    });
    expect(all.find((r) => r.row.id === String(ids.refund))?.row.direction).toBe('in');

    const incoming = await listTransactions(db, { range: OCT, direction: 'in' });
    expect(incoming.map((r) => r.row.id)).toEqual([String(ids.salary), String(ids.refund)]);

    const food = await listTransactions(db, { range: OCT, categoryId: 'food', direction: 'out' });
    expect(food.map((r) => r.row.id)).toEqual([ids.tagged, ids.lunch, ids.pharmacy].map(String));

    const byNote = await listTransactions(db, { range: OCT, search: 'PARACET' });
    expect(byNote.map((r) => r.row.id)).toEqual([String(ids.pharmacy)]);
    const byCategory = await listTransactions(db, { range: OCT, search: 'cash' });
    expect(byCategory.map((r) => r.row.id)).toEqual([String(ids.cash)]);
    const byName = await listTransactions(db, { range: OCT, search: ' circle ' });
    expect(byName).toHaveLength(1);
    expect(await listTransactions(db, { range: OCT, search: '%' })).toEqual([]);
    expect(await listTransactions(db, { search: 'mart' })).toHaveLength(1);
  });

  it('shows the detail with an approximate time, balance, note source and reversal state', async () => {
    const pharmacy = (await transactionDetail(db, ids.pharmacy, TODAY))!;
    expect(pharmacy).toMatchObject({
      counterparty: 'Kojo Pharmacy',
      categoryId: 'food',
      amount: 2400,
      note: 'paracetamol',
      noteSource: 'sms',
      balanceAfter: 41184,
      kindLabel: 'Paid to a merchant.',
      occurredAtLabel: 'Sat 3 Oct · 12:00',
      timeApproximate: false,
      reversed: true,
      reversesId: null,
    });
    const cash = (await transactionDetail(db, ids.cash, TODAY))!;
    expect(cash).toMatchObject({
      occurredAtLabel: 'Fri 9 Oct · about 12:00',
      timeApproximate: true,
      balanceAfter: null,
      kindLabel: 'Cash taken out at an agent.',
    });
    const refund = (await transactionDetail(db, ids.refund, TODAY))!;
    expect(refund).toMatchObject({
      reversed: false,
      reversesId: String(ids.pharmacy),
      counterparty: 'Refund',
      direction: 'in',
    });
    const tagged = (await transactionDetail(db, ids.tagged, TODAY))!;
    expect(tagged).toMatchObject({ note: 'rice', noteSource: 'user', categoryId: 'food' });
    expect(await transactionDetail(db, ids.lunch, TODAY)).toMatchObject({
      kindLabel: 'Added by you.',
      manual: true,
      noteSource: null,
    });
    expect(await transactionDetail(db, 9999, TODAY)).toBeNull();
  });

  it('lists payments that need a note, after the first import only', async () => {
    const now = at(10, 20, 15);
    expect(await needsNoteCount(db, OCT, now)).toBe(1);
    expect((await needsNoteList(db, OCT, now)).map((r) => r.row.id)).toEqual([
      String(ids.needsNote),
    ]);
    expect(await needsNoteCount(db, null, now)).toBe(1);
    // A snooze hides it until the snooze ends; a cleared note ('') counts as answered.
    await annotate(db, ids.needsNote, { prompt_snoozed_until: now + 1000 });
    expect(await needsNoteCount(db, OCT, now)).toBe(0);
    expect(await needsNoteCount(db, OCT, now + 2000)).toBe(1);
    await db.run('UPDATE transaction_annotations SET note = ? WHERE transaction_id = ?', [
      '',
      ids.needsNote,
    ]);
    expect(await needsNoteCount(db, OCT, now + 2000)).toBe(0);
    await db.run('DELETE FROM transaction_annotations WHERE transaction_id = ?', [ids.needsNote]);

    // Before any import there is no baseline, so nothing is asked.
    await db.run(`DELETE FROM meta WHERE key = 'first_import_at'`);
    expect(await needsNoteCount(db, OCT, now)).toBe(0);
    expect(await needsNoteList(db, OCT, now)).toEqual([]);
    await setMeta(db, 'first_import_at', String(at(10, 10)));
  });

  it('gives six months in and out ending at the chosen month, empty months as zero', async () => {
    const flows = await monthlyFlows(db, '2026-10');
    expect(flows.map((f) => f.monthId)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(flows[4]).toMatchObject({ out: 15000, in: 7000 });
    expect(flows[5]).toMatchObject({ out: 36316, in: 10000 });
    expect(flows[0]).toMatchObject({ out: 0, in: 0 });
    expect(await monthlyFlows(db, '2026-01', 2)).toHaveLength(2);
  });

  it('gives a day its total and categories', async () => {
    expect(await daySpend(db, '2026-10-09')).toEqual({
      total: 26000,
      spend: [{ categoryId: 'cash', amount: 26000 }],
    });
    expect(await daySpend(db, '2026-10-10')).toEqual({ total: 0, spend: [] });
  });

  it('averages a weekday over the days in the span', async () => {
    // Fridays between Sep 5 and Oct 20 2026: Sep 11, 18, 25, Oct 2, 9, 16 -> 6. Spend on Fridays:
    // Sep 25 (50.00) and Oct 9 (260.00).
    const friday = await weekdayAverage(db, 5);
    expect(friday.spend).toEqual([
      { categoryId: 'cash', amount: Math.round(26000 / 6) },
      { categoryId: 'food', amount: Math.round(5000 / 6) },
    ]);
    expect(friday.total).toBe(Math.round(26000 / 6) + Math.round(5000 / 6));
  });

  it('has no weekday average without spend, or when the weekday never occurs in the span', async () => {
    const empty = await setup();
    expect(await weekdayAverage(empty, 1)).toEqual({ total: 0, spend: [] });
    await addTxn(empty, { amount_pesewas: 100, occurred_at: at(10, 20) });
    expect(await weekdayAverage(empty, 1)).toEqual({ total: 0, spend: [] });
    empty.close();
  });
});
