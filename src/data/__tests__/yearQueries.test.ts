import type { Db } from '../db';
import { allTimeSummary, categorySpend, yearSummary, yearsWithData } from '../queries';
import { ALL_TIME, yearRange } from '@/domain/calendar/year';
import { addLink, addTxn, annotate, categoryId, setup } from './fixtures';

const utc = (y: number, m: number, d: number, h = 12, mi = 0, s = 0) =>
  Date.UTC(y, m - 1, d, h, mi, s);

let db: Db;

beforeAll(async () => {
  db = await setup();
  const food = await categoryId(db, 'food');
  const income = await categoryId(db, 'income');
  const auto = (id: number) => ({ auto_category_id: id, auto_category_source: 'keyword' });

  // 2024: one payment, one income.
  await addTxn(db, { amount_pesewas: 10000, occurred_at: utc(2024, 4, 10), ...auto(food) });
  await addTxn(db, {
    flow: 'income',
    kind: 'payment_in',
    amount_pesewas: 3000,
    occurred_at: utc(2024, 5, 1),
    ...auto(income),
  });
  // The last second of 2025 belongs to 2025; the first of 2026 to 2026. The fee is spend too.
  const last = await addTxn(db, {
    amount_pesewas: 20000,
    fee_pesewas: 100,
    occurred_at: utc(2025, 12, 31, 23, 59, 59),
    ...auto(food),
  });
  await addTxn(db, {
    amount_pesewas: 5000,
    occurred_at: utc(2026, 1, 1, 0, 0, 0),
    ...auto(food),
  });
  // A refund in 2026 nets into the original's year.
  const refund = await addTxn(db, {
    flow: 'credit',
    kind: 'refund',
    amount_pesewas: 4000,
    occurred_at: utc(2026, 1, 5),
    ...auto(food),
  });
  await addLink(db, refund, last);
  // A manual expense counts.
  const manual = await addTxn(db, {
    origin: 'manual',
    amount_pesewas: 700,
    occurred_at: utc(2026, 3, 3),
  });
  await annotate(db, manual, { category_id: food });
  // Retracted rows contribute nothing.
  await addTxn(db, { amount_pesewas: 99999, occurred_at: utc(2026, 2, 2), retracted_at: 1 });
});

describe('year and all-time queries', () => {
  it('lists the years with data, refunds netted into the original year', async () => {
    expect(await yearsWithData(db)).toEqual([
      { year: 2024, out: 10000, in: 3000 },
      { year: 2025, out: 20100 - 4000, in: 0 },
      { year: 2026, out: 5000 + 700, in: 0 },
    ]);
  });

  it('puts 23:59:59 on 31 Dec in the old year and 00:00:00 on 1 Jan in the new one', async () => {
    const y25 = await yearSummary(db, 2025);
    const y26 = await yearSummary(db, 2026);
    expect(y25.payments).toBe(1);
    expect(y26.payments).toBe(2);
    expect(y25.months[11]).toMatchObject({ monthId: '2025-12', out: 16100 });
    expect(y26.months[0]).toMatchObject({ monthId: '2026-01', out: 5000 });
  });

  it('gives a year twelve months, empty ones as zero, and the year before for comparison', async () => {
    const s = await yearSummary(db, 2026);
    expect(s.months.map((m) => m.monthId.slice(5))).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')),
    );
    expect(s).toMatchObject({ spent: 5700, moneyIn: 0, previousSpent: 16100 });
    expect(s.months[2]).toMatchObject({ out: 700 });
    expect(s.months[1]).toMatchObject({ out: 0 });
    expect(s.biggestMonth?.monthId).toBe('2026-01');
    expect((await yearSummary(db, 2024)).previousSpent).toBeNull();
  });

  it('gives a year with no payments zeroes', async () => {
    const s = await yearSummary(db, 2030);
    expect(s).toMatchObject({ spent: 0, moneyIn: 0, payments: 0, biggestMonth: null });
    expect(s.months).toHaveLength(12);
  });

  it('spends by category over a year and over everything', async () => {
    const spend = await categorySpend(db, yearRange(2025));
    expect(spend.reduce((a, s) => a + s.amount, 0)).toBe(16100);
    const all = await categorySpend(db, ALL_TIME);
    expect(all.reduce((a, s) => a + s.amount, 0)).toBe(10000 + 16100 + 5700);
  });

  it('sums all time from the first payment', async () => {
    const s = await allTimeSummary(db);
    expect(s).toMatchObject({
      spent: 10000 + 16100 + 5700,
      moneyIn: 3000,
      payments: 4,
      firstMonthId: '2024-04',
      lastMonthId: '2026-03',
    });
    expect(s.busiestYear?.year).toBe(2025);
    expect(s.busiestMonth?.monthId).toBe('2025-12');
    expect(s.years.reduce((a, y) => a + y.out, 0)).toBe(s.spent);
  });

  it('is empty on an empty database', async () => {
    const empty = await setup();
    expect(await yearsWithData(empty)).toEqual([]);
    expect(await allTimeSummary(empty)).toMatchObject({
      spent: 0,
      payments: 0,
      firstMonthId: null,
      busiestYear: null,
    });
  });
});
