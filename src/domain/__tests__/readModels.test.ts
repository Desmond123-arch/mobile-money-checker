import {
  addMonths,
  countWeekdays,
  dayRange,
  daysInMonth,
  monthIdOf,
  monthLabel,
  monthRange,
  monthShort,
} from '../calendar/month';
import { uiCategoryId } from '../category/ids';
import { pesewas } from '../money';
import { buildMonthSummary, type MonthFacts } from '../summary/month';
import { biggestMonth, monthBars, noMonth, trendHeading } from '../summary/trend';
import { groupByDay, signedAmount } from '../transaction/day';
import {
  dayHeading,
  fallbackCounterparty,
  kindLabel,
  occurredAtLabel,
  relativeDay,
} from '../transaction/label';
import type { TransactionRow } from '../transaction/transaction';

const TODAY = new Date('2026-10-20T10:00:00Z');

describe('month ranges', () => {
  it('are half open, UTC, and roll the year', () => {
    expect(monthRange('2026-10')).toEqual({
      start: Date.UTC(2026, 9, 1),
      end: Date.UTC(2026, 10, 1),
    });
    expect(monthRange('2026-12').end).toBe(Date.UTC(2027, 0, 1));
    expect(dayRange('2026-10-20')).toEqual({
      start: Date.UTC(2026, 9, 20),
      end: Date.UTC(2026, 9, 21),
    });
  });

  it('counts days, steps months and names them', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-10')).toBe(31);
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', 5)).toBe('2027-03');
    expect(monthIdOf(TODAY)).toBe('2026-10');
    expect(monthLabel('2026-06')).toBe('June 2026');
    expect(monthShort('2026-06')).toBe('Jun');
  });

  it('counts a weekday between two instants inclusive', () => {
    const start = Date.UTC(2026, 9, 1);
    const end = Date.UTC(2026, 9, 31, 23, 59);
    expect(countWeekdays(start, end, 5)).toBe(5);
    expect(countWeekdays(start, end, 1)).toBe(4);
    expect(countWeekdays(start, start, 4)).toBe(1);
  });
});

describe('uiCategoryId', () => {
  it('keeps system keys, maps misc to other, and stringifies user ids', () => {
    expect(uiCategoryId('food', 7)).toBe('food');
    expect(uiCategoryId('misc', 5)).toBe('other');
    expect(uiCategoryId(null, 42)).toBe('42');
  });
});

describe('labels', () => {
  it('words the kind and the fallback name', () => {
    expect(kindLabel('payment_out')).toBe('Paid to a merchant.');
    expect(kindLabel('something_new')).toBe('Mobile money.');
    expect(fallbackCounterparty('cash_out')).toBe('Cash out');
    expect(fallbackCounterparty('payment_out')).toBe('MoMo payment');
  });

  it('formats date and time, with the year only when it differs', () => {
    const at = Date.UTC(2026, 9, 20, 12, 41);
    expect(occurredAtLabel(at, false, TODAY)).toBe('Tue 20 Oct · 12:41');
    expect(occurredAtLabel(at, true, TODAY)).toBe('Tue 20 Oct · about 12:41');
    expect(occurredAtLabel(Date.UTC(2024, 5, 3, 9, 5), false, TODAY)).toBe(
      'Mon 3 Jun 2024 · 09:05',
    );
  });

  it('names today, yesterday and older days', () => {
    expect(relativeDay('2026-10-20', TODAY)).toBe('Today');
    expect(relativeDay('2026-10-19', TODAY)).toBe('Yesterday');
    expect(relativeDay('2026-10-18', TODAY)).toBe('Sun 18 Oct');
    expect(dayHeading('2026-10-20', TODAY)).toBe('Today · Tue 20 Oct');
    expect(dayHeading('2026-10-19', TODAY)).toBe('Yesterday · Mon 19 Oct');
    expect(dayHeading('2026-10-18', TODAY)).toBe('Sun 18 Oct');
  });
});

describe('groupByDay', () => {
  const row = (id: string, direction: 'in' | 'out', amount: number): TransactionRow => ({
    id,
    counterparty: id,
    categoryId: null,
    note: null,
    direction,
    amount: pesewas(amount),
  });

  it('groups consecutive days, keeps order and nets money in against money out', () => {
    const groups = groupByDay(
      [
        { iso: '2026-10-20', row: row('a', 'out', 2400) },
        { iso: '2026-10-20', row: row('b', 'out', 1850) },
        { iso: '2026-10-19', row: row('c', 'in', 10000) },
      ],
      TODAY,
    );
    expect(groups.map((g) => [g.label, g.total, g.rows.map((r) => r.id)])).toEqual([
      ['Today · Tue 20 Oct', -4250, ['a', 'b']],
      ['Yesterday · Mon 19 Oct', 10000, ['c']],
    ]);
    expect(signedAmount(row('x', 'out', 5))).toBe(-5);
  });
});

describe('buildMonthSummary', () => {
  const base: MonthFacts = {
    monthId: '2026-10',
    isCurrent: true,
    elapsedDays: 20,
    spent: pesewas(124050),
    moneyIn: pesewas(80000),
    payments: 38,
    needNote: 3,
    spendByDay: new Map([
      [9, pesewas(26000)],
      [3, pesewas(1000)],
      [4, pesewas(-500)],
    ]),
    previous: { monthId: '2026-09', spent: pesewas(141000) },
  };

  it('words the delta against the same span of the month before', () => {
    const s = buildMonthSummary(base);
    expect(s).toMatchObject({
      label: 'October 2026',
      deltaLabel: '12% less',
      deltaCompare: 'than this time in September',
      today: 20,
      daysInMonth: 31,
      peakLabel: 'Fri 9 Oct, GHS 260.00',
    });
    expect(s.daily).toHaveLength(31);
    expect(s.daily[8]).toBe(26000);
    expect(s.daily[3]).toBe(0);
  });

  it('handles more, equal, a finished month and no previous month', () => {
    expect(buildMonthSummary({ ...base, spent: pesewas(282000) })).toMatchObject({
      deltaLabel: '100% more',
    });
    expect(buildMonthSummary({ ...base, spent: pesewas(141000) })).toMatchObject({
      deltaLabel: 'No change',
      deltaCompare: 'from September',
    });
    expect(buildMonthSummary({ ...base, isCurrent: false })).toMatchObject({
      deltaCompare: 'than September',
    });
    expect(buildMonthSummary({ ...base, previous: null })).toMatchObject({
      deltaLabel: 'First month',
      deltaCompare: 'on record',
    });
    expect(
      buildMonthSummary({ ...base, previous: { monthId: '2026-09', spent: pesewas(0) } }),
    ).toMatchObject({ deltaLabel: 'First month' });
  });

  it('has no peak when nothing was spent', () => {
    const s = buildMonthSummary({ ...base, spendByDay: new Map() });
    expect(s.peakLabel).toBeNull();
    expect(s.daily.every((d) => d === 0)).toBe(true);
  });
});

describe('trend', () => {
  const flows = [
    { monthId: '2026-05', out: pesewas(118000), in: pesewas(96000) },
    { monthId: '2026-08', out: pesewas(161000), in: pesewas(127000) },
    noMonth('2026-10'),
  ];

  it('picks the biggest month and words the heading', () => {
    expect(biggestMonth(flows)?.monthId).toBe('2026-08');
    expect(trendHeading(flows)).toEqual({
      title: 'August was your biggest month',
      subtitle: 'Money out and in, May to October',
    });
  });

  it('says so when nothing was spent', () => {
    expect(biggestMonth([noMonth('2026-10')])).toBeNull();
    expect(trendHeading([noMonth('2026-09'), noMonth('2026-10')]).title).toBe(
      'Nothing spent in these months',
    );
    expect(trendHeading([]).subtitle).toBe('Money out and in');
  });

  it('rounds the chart to whole cedis and never goes negative', () => {
    expect(monthBars([{ monthId: '2026-05', out: pesewas(118050), in: pesewas(-10) }])).toEqual([
      { label: 'May', out: 1181, in: 0 },
    ]);
  });
});
