import { pesewas } from '../../money';
import { buildBudgetView } from '../view';
import { fitToTotal, previousSpan, suggestPlan } from '../suggest';

const plan = { id: 1, name: null, startDay: '2026-11-01', endDay: '2026-11-10', total: 100_000 };
const spend = (...rows: [string, number][]) =>
  rows.map(([categoryId, amount]) => ({ categoryId, amount: pesewas(amount) }));

describe('buildBudgetView', () => {
  it('sorts limits biggest first and measures each against its own spend', () => {
    const view = buildBudgetView(
      plan,
      [
        { categoryId: 'transport', amount: 20_000 },
        { categoryId: 'food', amount: 40_000 },
      ],
      spend(['food', 36_000], ['transport', 5_000], ['health', 7_000]),
      48_000,
      '2026-11-05',
    );
    expect(view.categories.map((c) => c.categoryId)).toEqual(['food', 'transport']);
    expect(view.categories[0]?.progress).toMatchObject({ spent: 36_000, tone: 'watch' });
    expect(view.categories[1]?.progress).toMatchObject({ spent: 5_000, tone: 'fine' });
    expect(view.total).toMatchObject({ limit: 100_000, spent: 48_000 });
    expect(view.status).toBe('active');
    expect(view.headline).toBe('GHS 86.66 a day keeps you inside it.');
  });

  it('puts what is outside the limits in a rest line', () => {
    const view = buildBudgetView(
      plan,
      [{ categoryId: 'food', amount: 40_000 }],
      spend(['food', 10_000], ['health', 7_000]),
      17_000,
      '2026-11-05',
    );
    expect(view.unplanned).toBe(60_000);
    expect(view.rest).toMatchObject({ limit: 60_000, spent: 7_000, tone: 'fine' });
  });

  it('has no rest line without limits, or when the limits use the whole plan and nothing else was spent', () => {
    expect(buildBudgetView(plan, [], spend(['food', 100]), 100, '2026-11-05').rest).toBeNull();
    expect(
      buildBudgetView(
        plan,
        [{ categoryId: 'food', amount: 100_000 }],
        spend(['food', 100]),
        100,
        '2026-11-05',
      ).rest,
    ).toBeNull();
  });

  it('shows spend outside fully used limits as over', () => {
    const view = buildBudgetView(
      plan,
      [{ categoryId: 'food', amount: 100_000 }],
      spend(['food', 100], ['health', 900]),
      1_000,
      '2026-11-05',
    );
    expect(view.rest).toMatchObject({ limit: 0, spent: 900, tone: 'over' });
  });

  it('reports an upcoming and an ended plan', () => {
    expect(buildBudgetView(plan, [], [], 0, '2026-10-25').pace.startsIn).toBe(7);
    const ended = buildBudgetView(plan, [], spend(['food', 120_000]), 120_000, '2026-11-20');
    expect(ended.status).toBe('ended');
    expect(ended.headline).toBe('You finished GHS 200.00 over.');
  });

  it('does not let a net-negative remainder go below zero', () => {
    const view = buildBudgetView(
      plan,
      [{ categoryId: 'food', amount: 10_000 }],
      spend(['food', 5_000]),
      4_000,
      '2026-11-05',
    );
    expect(view.rest).toMatchObject({ spent: 0 });
  });
});

describe('previousSpan', () => {
  it('is the same number of days right before the start', () => {
    expect(previousSpan('2026-11-01', 7)).toEqual({ startDay: '2026-10-25', endDay: '2026-10-31' });
    expect(previousSpan('2026-01-03', 5)).toEqual({ startDay: '2025-12-29', endDay: '2026-01-02' });
  });
});

describe('suggestPlan', () => {
  it('scales the past to the new length and rounds up to tidy amounts', () => {
    const s = suggestPlan(spend(['food', 30_000], ['transport', 12_345], ['health', 500]), 30, 15);
    expect(s?.limits).toEqual([
      { categoryId: 'food', amount: 15_000 },
      { categoryId: 'transport', amount: 7_000 },
      { categoryId: 'health', amount: 1_000 },
    ]);
    expect(s?.total).toBe(25_000);
  });

  it('keeps the five biggest categories and gives the total the rest', () => {
    const rows: [string, number][] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => [
      k,
      10_000 - i * 1_000,
    ]);
    const s = suggestPlan(spend(...rows), 10, 10)!;
    expect(s.limits.map((l) => l.categoryId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(s.total).toBeGreaterThanOrEqual(s.limits.reduce((n, l) => n + l.amount, 0));
    expect(s.total).toBe(49_000 + 1_000);
  });

  it('never suggests limits that add up to more than the total', () => {
    const s = suggestPlan(spend(['a', 101], ['b', 101], ['c', 101]), 3, 3)!;
    const limits = s.limits.reduce((n, l) => n + l.amount, 0);
    expect(s.total).toBeGreaterThanOrEqual(limits);
    expect(s.total % 5_000).toBe(0);
  });

  it('has nothing to suggest from an empty past', () => {
    expect(suggestPlan([], 7, 7)).toBeNull();
    expect(suggestPlan(spend(['food', 0]), 7, 7)).toBeNull();
    expect(suggestPlan(spend(['food', 100]), 0, 7)).toBeNull();
    expect(suggestPlan(spend(['food', 100]), 7, 0)).toBeNull();
  });
});

describe('fitToTotal', () => {
  it('keeps the biggest limits that fit, skipping one that does not and trying the next', () => {
    const limits = [{ amount: 600 }, { amount: 500 }, { amount: 300 }, { amount: 100 }];
    expect(fitToTotal(limits, 1_000)).toEqual([{ amount: 600 }, { amount: 300 }, { amount: 100 }]);
    expect(fitToTotal(limits, 50)).toEqual([]);
    expect(fitToTotal(limits, 10_000)).toEqual(limits);
  });
});
