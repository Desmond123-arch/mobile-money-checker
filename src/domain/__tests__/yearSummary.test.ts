import { ALL_TIME, yearMonthIds, yearOfMonth, yearRange } from '../calendar/year';
import { pesewas } from '../money';
import { compareSpend, percentChange } from '../summary/compare';
import type { MonthFlow } from '../summary/trend';
import {
  buildAllTimeSummary,
  buildYearSummary,
  spanLabel,
  yearBars,
  yearFlowsOf,
} from '../summary/year';

const flow = (monthId: string, out: number, inn = 0): MonthFlow => ({
  monthId,
  out: pesewas(out),
  in: pesewas(inn),
});

describe('year ranges', () => {
  it('runs from 1 Jan 00:00:00 UTC to the next 1 Jan, exclusive', () => {
    const r = yearRange(2025);
    expect(r.start).toBe(Date.parse('2025-01-01T00:00:00Z'));
    expect(r.end).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(Date.parse('2025-12-31T23:59:59Z')).toBeLessThan(r.end);
  });

  it('names the twelve months and the year of a month', () => {
    const ids = yearMonthIds(2026);
    expect(ids).toHaveLength(12);
    expect(ids[0]).toBe('2026-01');
    expect(ids[11]).toBe('2026-12');
    expect(yearOfMonth('2024-04')).toBe(2024);
  });

  it('covers every instant with all time', () => {
    expect(ALL_TIME.start).toBeLessThanOrEqual(yearRange(1999).start);
    expect(ALL_TIME.end).toBeGreaterThan(yearRange(2999).end);
  });
});

describe('percentChange and compareSpend', () => {
  it('has no change against nothing', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(compareSpend(pesewas(500), pesewas(0), '2025')).toBeNull();
    expect(compareSpend(pesewas(500), null, '2025')).toBeNull();
  });

  it('rounds to whole percent, negative when lower', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(0, 100)).toBe(-100);
  });

  it('points up for a rise and down for a fall', () => {
    expect(compareSpend(pesewas(1120), pesewas(1000), '2025')).toEqual({
      direction: 'up',
      percent: 12,
      text: '12% more than 2025',
    });
    expect(compareSpend(pesewas(880), pesewas(1000), '2025')).toEqual({
      direction: 'down',
      percent: 12,
      text: '12% less than 2025',
    });
  });

  it('calls a change that rounds to nothing about the same', () => {
    expect(compareSpend(pesewas(1001), pesewas(1000), '2025')).toEqual({
      direction: 'same',
      percent: 0,
      text: 'About the same as 2025',
    });
  });
});

describe('year and all-time summaries', () => {
  const months = [
    flow('2024-11', 100, 50),
    flow('2024-12', 300, 0),
    flow('2025-02', 200, 400),
    flow('2026-06', 250, 10),
  ];

  it('totals a year and finds its biggest month', () => {
    const s = buildYearSummary(2024, months.slice(0, 2), 7, pesewas(0));
    expect(s).toMatchObject({ year: 2024, spent: 400, moneyIn: 50, payments: 7 });
    expect(s.biggestMonth?.monthId).toBe('2024-12');
    expect(s.previousSpent).toBeNull();
    expect(buildYearSummary(2025, [flow('2025-01', 0)], 0, pesewas(400)).previousSpent).toBe(400);
    expect(buildYearSummary(2025, [flow('2025-01', 0)], 0, pesewas(0)).biggestMonth).toBeNull();
  });

  it('groups months into years, oldest first', () => {
    expect(yearFlowsOf([...months].reverse())).toEqual([
      { year: 2024, out: 400, in: 50 },
      { year: 2025, out: 200, in: 400 },
      { year: 2026, out: 250, in: 10 },
    ]);
  });

  it('sums everything and finds the busiest year and month', () => {
    const s = buildAllTimeSummary(months, 12);
    expect(s).toMatchObject({
      spent: 850,
      moneyIn: 460,
      payments: 12,
      firstMonthId: '2024-11',
      lastMonthId: '2026-06',
    });
    expect(s.busiestYear?.year).toBe(2024);
    expect(s.busiestMonth?.monthId).toBe('2024-12');
    expect(s.years).toHaveLength(3);
  });

  it('handles a history with nothing spent, or a single month', () => {
    const none = buildAllTimeSummary([], 0);
    expect(none).toMatchObject({ spent: 0, firstMonthId: null, busiestYear: null });
    const one = buildAllTimeSummary([flow('2026-06', 0, 90)], 0);
    expect(one.busiestYear).toBeNull();
    expect(one.busiestMonth).toBeNull();
    expect(one.moneyIn).toBe(90);
  });

  it('labels the span and the bars', () => {
    expect(spanLabel('2024-04', '2026-06')).toBe('Apr 2024 to Jun 2026');
    expect(spanLabel('2026-06', '2026-06')).toBe('Jun 2026');
    expect(yearBars([{ year: 2025, out: pesewas(12_345), in: pesewas(-5) }])).toEqual([
      { label: '2025', out: 123, in: 0 },
    ]);
  });
});
