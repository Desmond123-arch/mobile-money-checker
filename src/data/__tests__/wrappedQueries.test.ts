import type { Db } from '../db';
import {
  activeDays,
  biggestPayment,
  categorySpend,
  topCounterparties,
  weekdayTotals,
  wrappedFacts,
  yearSummary,
} from '../queries';
import { ALL_TIME, yearRange } from '@/domain/calendar/year';
import { buildWrapped } from '@/domain/summary/wrapped';
import { addLink, addTxn, annotate, categoryId, setup } from './fixtures';

const utc = (y: number, m: number, d: number, h = 12, mi = 0, s = 0) =>
  Date.UTC(y, m - 1, d, h, mi, s);
const Y25 = yearRange(2025);
const sumOf = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

let db: Db;

beforeAll(async () => {
  db = await setup();
  const food = await categoryId(db, 'food');
  const named = (counterparty_name: string | null, over = {}) => ({
    counterparty_name,
    auto_category_id: food,
    auto_category_source: 'keyword',
    ...over,
  });

  await addTxn(db, {
    amount_pesewas: 10000,
    fee_pesewas: 100,
    occurred_at: utc(2025, 3, 3),
    ...named('Ama Store'),
  });
  await addTxn(db, { amount_pesewas: 5000, occurred_at: utc(2025, 3, 4), ...named('ama store') });
  const kofi = await addTxn(db, {
    amount_pesewas: 40000,
    occurred_at: utc(2025, 3, 10),
    ...named('Kofi Fruits'),
  });
  const refund = await addTxn(db, {
    flow: 'credit',
    kind: 'refund',
    amount_pesewas: 10000,
    occurred_at: utc(2025, 3, 15),
    ...named('Kofi Fruits'),
  });
  await addLink(db, refund, kofi);
  await addTxn(db, {
    amount_pesewas: 8000,
    merchant_code: '123456',
    occurred_at: utc(2025, 3, 11),
    ...named(null),
  });
  await addTxn(db, {
    amount_pesewas: 25000,
    is_self_transfer: 1,
    occurred_at: utc(2025, 3, 12),
    ...named('Me Myself'),
  });
  const manual = await addTxn(db, {
    origin: 'manual',
    amount_pesewas: 700,
    counterparty_name: 'Lunch',
    occurred_at: utc(2025, 3, 12, 18),
  });
  await annotate(db, manual, { category_id: food });
  await addTxn(db, {
    amount_pesewas: 99999,
    retracted_at: 1,
    occurred_at: utc(2025, 4, 1),
    ...named('Ghost'),
  });
  await addTxn(db, {
    amount_pesewas: 1000,
    occurred_at: utc(2025, 12, 31, 23, 59, 59),
    ...named('Zed'),
  });
  await addTxn(db, {
    amount_pesewas: 2000,
    occurred_at: utc(2026, 1, 1, 0, 0, 0),
    ...named('Zed'),
  });
});

describe('topCounterparties', () => {
  it('ranks by net spend, merges names ignoring case, nets refunds, leaves out the rest', async () => {
    expect(await topCounterparties(db, Y25, 10)).toEqual([
      { name: 'Kofi Fruits', spent: 30000, count: 1 },
      { name: 'Ama Store', spent: 15100, count: 2 },
      { name: 'Zed', spent: 1000, count: 1 },
    ]);
  });

  it('ranks by number of payments, and honours n', async () => {
    const top = await topCounterparties(db, Y25, 1, 'count');
    expect(top).toEqual([{ name: 'Ama Store', spent: 15100, count: 2 }]);
  });

  it('puts the year boundary on the right side', async () => {
    expect(await topCounterparties(db, yearRange(2026), 5)).toEqual([
      { name: 'Zed', spent: 2000, count: 1 },
    ]);
    expect((await topCounterparties(db, ALL_TIME, 5))[2]).toEqual({
      name: 'Zed',
      spent: 3000,
      count: 2,
    });
  });

  it('is empty for a range with nothing', async () => {
    expect(await topCounterparties(db, yearRange(2030), 3)).toEqual([]);
  });
});

describe('biggestPayment', () => {
  it('takes refunds off and ignores retracted rows', async () => {
    expect(await biggestPayment(db, Y25)).toEqual({
      amount: 30000,
      who: 'Kofi Fruits',
      iso: '2025-03-10',
    });
  });

  it('has no name for a merchant-code payment', async () => {
    const only = await setup();
    await addTxn(only, { amount_pesewas: 700, merchant_code: '99', occurred_at: utc(2025, 5, 5) });
    expect(await biggestPayment(only, ALL_TIME)).toEqual({
      amount: 700,
      who: null,
      iso: '2025-05-05',
    });
  });

  it('names a typed-in expense by what it was for, and takes the earliest on a tie', async () => {
    const tie = await setup();
    await addTxn(tie, {
      origin: 'manual',
      amount_pesewas: 500,
      counterparty_name: 'Bread',
      occurred_at: utc(2025, 6, 2),
    });
    await addTxn(tie, {
      amount_pesewas: 500,
      counterparty_name: 'Later',
      occurred_at: utc(2025, 6, 9),
    });
    expect(await biggestPayment(tie, ALL_TIME)).toMatchObject({ who: 'Bread', iso: '2025-06-02' });
  });

  it('is null when nothing was spent', async () => {
    expect(await biggestPayment(db, yearRange(2030))).toBeNull();
  });
});

describe('weekdayTotals and activeDays', () => {
  it('splits net spend by weekday and adds up to the year total', async () => {
    const days = await weekdayTotals(db, Y25);
    expect(days).toHaveLength(7);
    expect(sumOf(days)).toBe((await yearSummary(db, 2025)).spent);
    const monday = new Date(utc(2025, 3, 3)).getUTCDay();
    expect(days[monday]).toBe(10100 + 30000);
  });

  it('counts days with net spending and the stretch between the first and last', async () => {
    const stretch = (utc(2025, 12, 31) - utc(2025, 3, 3)) / 86_400_000 + 1;
    expect(await activeDays(db, Y25)).toEqual({ span: stretch, active: 6 });
  });

  it('does not count a day whose spending was fully refunded', async () => {
    const d = await setup();
    const paid = await addTxn(d, { amount_pesewas: 500, occurred_at: utc(2025, 2, 1) });
    const credit = await addTxn(d, {
      flow: 'credit',
      kind: 'refund',
      amount_pesewas: 500,
      occurred_at: utc(2025, 2, 2),
    });
    await addLink(d, credit, paid);
    await addTxn(d, { amount_pesewas: 100, occurred_at: utc(2025, 2, 5) });
    expect(await activeDays(d, ALL_TIME)).toEqual({ span: 1, active: 1 });
  });

  it('is zero when there is nothing', async () => {
    expect(await activeDays(db, yearRange(2030))).toEqual({ span: 0, active: 0 });
    expect(await weekdayTotals(db, yearRange(2030))).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('wrappedFacts', () => {
  it('matches the Insights year numbers and builds slides', async () => {
    const facts = await wrappedFacts(db, { kind: 'year', year: 2025 });
    const summary = await yearSummary(db, 2025);
    expect(facts).toMatchObject({ spent: summary.spent, payments: summary.payments });
    expect(sumOf(facts.categories.map((c) => c.amount))).toBe(
      sumOf((await categorySpend(db, Y25)).map((c) => c.amount)),
    );
    expect(facts.categories[0]).toMatchObject({ id: 'food', name: 'Food' });
    expect(facts.topBySpend?.name).toBe('Kofi Fruits');
    expect(buildWrapped(facts).map((s) => s.kind)).toContain('person');
  });

  it('covers all time, and gives no slides on an empty database', async () => {
    const all = await wrappedFacts(db, { kind: 'all' });
    expect(all.months.map((m) => m.monthId)).toEqual(['2025-03', '2025-12', '2026-01']);
    expect(all.spent).toBe(sumOf(all.months.map((m) => m.out)));
    const empty = await wrappedFacts(await setup(), { kind: 'all' });
    expect(buildWrapped(empty)).toEqual([]);
  });
});
