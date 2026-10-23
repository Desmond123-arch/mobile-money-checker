import {
  MAX_PLAN_DAYS,
  PERIOD_PRESETS,
  addDays,
  cleanName,
  defaultPreset,
  daysBetween,
  featuredPlan,
  isIsoDay,
  limitProblem,
  limitsProblem,
  monthEndDay,
  planDays,
  planProblem,
  planRange,
  planStatus,
  presetEnd,
} from '../plan';

const ok = { startDay: '2026-11-01', endDay: '2026-11-30', total: 100_000 };
const none = { others: [], limitsTotal: 0 };

describe('days', () => {
  it('accepts real calendar days only', () => {
    expect(isIsoDay('2026-11-30')).toBe(true);
    expect(isIsoDay('2028-02-29')).toBe(true);
    expect(isIsoDay('2026-02-29')).toBe(false);
    expect(isIsoDay('2026-13-01')).toBe(false);
    expect(isIsoDay('26-11-01')).toBe(false);
    expect(isIsoDay('')).toBe(false);
  });

  it('adds, counts and crosses month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-01', '2026-11-30')).toBe(29);
    expect(daysBetween('2026-11-05', '2026-11-01')).toBe(-4);
    expect(planDays('2026-11-01', '2026-11-30')).toBe(30);
    expect(planDays('2026-11-01', '2026-11-01')).toBe(1);
  });

  it('turns a plan into a half-open range that includes the last day', () => {
    expect(planRange('2026-11-01', '2026-11-02')).toEqual({
      start: Date.UTC(2026, 10, 1),
      end: Date.UTC(2026, 10, 3),
    });
  });

  it('finds the last day of a month', () => {
    expect(monthEndDay('2026-11-14')).toBe('2026-11-30');
    expect(monthEndDay('2028-02-03')).toBe('2028-02-29');
    expect(monthEndDay('2026-12-31')).toBe('2026-12-31');
  });
});

describe('presets', () => {
  it('ends a week and a fortnight on the right day', () => {
    expect(presetEnd('2026-11-01', 'week')).toBe('2026-11-07');
    expect(presetEnd('2026-11-01', 'fortnight')).toBe('2026-11-14');
  });

  it('runs to month end from any day', () => {
    expect(presetEnd('2026-11-18', 'month')).toBe('2026-11-30');
  });

  it('lists a custom end last', () => {
    expect(PERIOD_PRESETS.at(-1)?.id).toBe('custom');
  });
});

describe('status and the featured plan', () => {
  const plan = { startDay: '2026-11-05', endDay: '2026-11-11' };

  it('is upcoming, active (both end days) or ended', () => {
    expect(planStatus(plan, '2026-11-04')).toBe('upcoming');
    expect(planStatus(plan, '2026-11-05')).toBe('active');
    expect(planStatus(plan, '2026-11-11')).toBe('active');
    expect(planStatus(plan, '2026-11-12')).toBe('ended');
  });

  it('prefers the running plan, then the next to start, then the latest ended', () => {
    const past = { startDay: '2026-09-01', endDay: '2026-09-30' };
    const now = { startDay: '2026-10-01', endDay: '2026-10-31' };
    const next = { startDay: '2026-11-01', endDay: '2026-11-30' };
    const later = { startDay: '2026-12-01', endDay: '2026-12-31' };
    expect(featuredPlan([past, next, now, later], '2026-10-15')).toBe(now);
    expect(featuredPlan([past, later, next], '2026-10-15')).toBe(next);
    expect(featuredPlan([next, past, now], '2027-01-01')).toBe(next);
    expect(featuredPlan([], '2026-10-15')).toBeNull();
  });
});

describe('planProblem', () => {
  it('accepts a good plan', () => {
    expect(planProblem(ok, none)).toBeNull();
    expect(planProblem({ ...ok, endDay: ok.startDay }, none)).toBeNull();
  });

  it('names each fault in the order the form is filled', () => {
    expect(planProblem({ ...ok, startDay: '' }, none)).toBe('Pick the day it starts.');
    expect(planProblem({ ...ok, endDay: '2026-02-30' }, none)).toBe('Pick the day it ends.');
    expect(planProblem({ ...ok, endDay: '2026-10-31' }, none)).toBe(
      'A plan cannot end before it starts.',
    );
    expect(planProblem({ ...ok, endDay: addDays(ok.startDay, MAX_PLAN_DAYS) }, none)).toBe(
      'A plan can run for up to a year.',
    );
    expect(
      planProblem({ ...ok, endDay: addDays(ok.startDay, MAX_PLAN_DAYS - 1) }, none),
    ).toBeNull();
    for (const total of [null, 0, -5, 10.5, Number.NaN]) {
      expect(planProblem({ ...ok, total }, none)).toBe('Enter how much you plan to spend.');
    }
  });

  it('will not drop the total under the limits already set', () => {
    expect(planProblem({ ...ok, total: 4_000 }, { others: [], limitsTotal: 5_000 })).toBe(
      'Your category limits add up to GHS 50.00. Raise the total or lower them first.',
    );
    expect(planProblem({ ...ok, total: 5_000 }, { others: [], limitsTotal: 5_000 })).toBeNull();
  });

  it('keeps the name short', () => {
    expect(planProblem({ ...ok, name: 'x'.repeat(30) }, none)).toBeNull();
    expect(planProblem({ ...ok, name: 'x'.repeat(31) }, none)).toBe(
      'Keep the name under 31 letters.',
    );
    expect(planProblem({ ...ok, name: '   ' }, none)).toBeNull();
  });

  it('refuses a plan that shares even one day with another', () => {
    const other = { startDay: '2026-10-20', endDay: '2026-11-01' };
    expect(planProblem(ok, { others: [other], limitsTotal: 0 })).toBe(
      'That overlaps your plan for Tue 20 Oct to Sun 1 Nov.',
    );
    const touching = { startDay: '2026-10-20', endDay: '2026-10-31' };
    expect(planProblem(ok, { others: [touching], limitsTotal: 0 })).toBeNull();
    const inside = { startDay: '2026-11-10', endDay: '2026-11-12' };
    expect(planProblem(ok, { others: [inside], limitsTotal: 0 })).not.toBeNull();
  });
});

describe('cleanName', () => {
  it('trims and turns blank into null', () => {
    expect(cleanName('  Rent month ')).toBe('Rent month');
    expect(cleanName('  ')).toBeNull();
    expect(cleanName(null)).toBeNull();
    expect(cleanName(undefined)).toBeNull();
  });
});

describe('limitProblem', () => {
  it('needs a category and a positive whole amount', () => {
    expect(limitProblem({ categoryId: null, amount: 100 }, 1_000)).toBe('Pick a category.');
    expect(limitProblem({ categoryId: '', amount: 100 }, 1_000)).toBe('Pick a category.');
    expect(limitProblem({ categoryId: 'food', amount: null }, 1_000)).toBe(
      'Enter an amount above 0.',
    );
    expect(limitProblem({ categoryId: 'food', amount: 0 }, 1_000)).toBe('Enter an amount above 0.');
    expect(limitProblem({ categoryId: 'food', amount: 1.5 }, 1_000)).toBe(
      'Enter an amount above 0.',
    );
  });

  it('keeps income out', () => {
    expect(limitProblem({ categoryId: 'income', amount: 100 }, 1_000)).toBe(
      'Income is not spending, so it takes no limit.',
    );
  });

  it('stays within what the plan has left to give', () => {
    expect(limitProblem({ categoryId: 'food', amount: 1_000 }, 1_000)).toBeNull();
    expect(limitProblem({ categoryId: 'food', amount: 1_001 }, 1_000)).toBe(
      'That is more than the plan has left to give (GHS 10.00).',
    );
    expect(limitProblem({ categoryId: 'food', amount: 1 }, 0)).toBe(
      'The plan has nothing left to give. Raise the total first.',
    );
  });
});

describe('limitsProblem', () => {
  it('checks every limit, repeats and the sum', () => {
    expect(limitsProblem([], 1_000)).toBeNull();
    expect(
      limitsProblem(
        [
          { categoryId: 'food', amount: 400 },
          { categoryId: 'transport', amount: 600 },
        ],
        1_000,
      ),
    ).toBeNull();
    expect(
      limitsProblem(
        [
          { categoryId: 'food', amount: 400 },
          { categoryId: 'food', amount: 100 },
        ],
        1_000,
      ),
    ).toBe('Each category can have one limit.');
    expect(
      limitsProblem(
        [
          { categoryId: 'food', amount: 600 },
          { categoryId: 'transport', amount: 600 },
        ],
        1_000,
      ),
    ).toBe('The limits add up to GHS 12.00, which is more than the total.');
    expect(limitsProblem([{ categoryId: 'food', amount: 0 }], 1_000)).toBe(
      'Enter an amount above 0.',
    );
  });
});

describe('defaultPreset', () => {
  it('runs to month end with two weeks or more left, else a fortnight', () => {
    expect(defaultPreset('2026-11-01')).toBe('month');
    expect(defaultPreset('2026-11-17')).toBe('month');
    expect(defaultPreset('2026-11-18')).toBe('fortnight');
    expect(defaultPreset('2026-11-30')).toBe('fortnight');
  });
});
