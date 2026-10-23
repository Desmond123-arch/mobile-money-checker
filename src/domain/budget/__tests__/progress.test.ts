import { paceLine, paceOf, progressOf } from '../progress';

describe('progressOf', () => {
  it('is fine under 80%, amber from 80%, over past the limit', () => {
    expect(progressOf(1_000, 799).tone).toBe('fine');
    expect(progressOf(1_000, 800).tone).toBe('watch');
    expect(progressOf(1_000, 1_000).tone).toBe('watch');
    expect(progressOf(1_000, 1_001).tone).toBe('over');
  });

  it('reports what is left and what is over, never negative', () => {
    expect(progressOf(1_000, 250)).toMatchObject({ left: 750, over: 0, fraction: 0.25 });
    expect(progressOf(1_000, 1_400)).toMatchObject({ left: 0, over: 400, fraction: 1 });
  });

  it('treats a net refund as nothing spent', () => {
    expect(progressOf(1_000, -50)).toMatchObject({ spent: 0, left: 1_000, tone: 'fine' });
  });

  it('has no divide by zero for a limit of 0', () => {
    expect(progressOf(0, 0)).toMatchObject({ fraction: 0, tone: 'fine' });
    expect(progressOf(0, 300)).toMatchObject({ fraction: 1, tone: 'over', over: 300 });
  });
});

const plan = { startDay: '2026-11-01', endDay: '2026-11-10', total: 10_000 };

describe('paceOf', () => {
  it('counts down to a plan that has not started', () => {
    expect(paceOf(plan, 0, '2026-10-29')).toMatchObject({
      status: 'upcoming',
      days: 10,
      dayNumber: 0,
      startsIn: 3,
      daysLeft: 0,
    });
  });

  it('counts today as a day to spend in', () => {
    const first = paceOf(plan, 0, '2026-11-01');
    expect(first).toMatchObject({ status: 'active', dayNumber: 1, daysLeft: 10, expected: 1_000 });
    expect(first.safePerDay).toBe(1_000);
    const last = paceOf(plan, 9_000, '2026-11-10');
    expect(last).toMatchObject({ dayNumber: 10, daysLeft: 1, expected: 10_000, safePerDay: 1_000 });
  });

  it('spreads what is left over the days that remain, rounding down', () => {
    expect(paceOf(plan, 4_000, '2026-11-04').safePerDay).toBe(857);
    expect(paceOf(plan, 4_000, '2026-11-05').safePerDay).toBe(1_000);
    expect(paceOf({ ...plan, total: 10_001 }, 0, '2026-11-04').safePerDay).toBe(1_428);
  });

  it('has nothing safe to spend once over', () => {
    expect(paceOf(plan, 12_000, '2026-11-04').safePerDay).toBe(0);
  });

  it('closes a plan that has ended', () => {
    expect(paceOf(plan, 5_000, '2026-11-11')).toMatchObject({
      status: 'ended',
      dayNumber: 10,
      daysLeft: 0,
      expected: 10_000,
    });
  });
});

describe('paceLine', () => {
  const line = (spent: number, today: string) =>
    paceLine(plan, progressOf(plan.total, spent), paceOf(plan, spent, today));

  it('says when it starts', () => {
    expect(line(0, '2026-10-20')).toBe('Starts Sun 1 Nov.');
  });

  it('gives the safe daily amount while it runs', () => {
    expect(line(4_000, '2026-11-04')).toBe('GHS 8.57 a day keeps you inside it.');
  });

  it('says it is the last day', () => {
    expect(line(9_000, '2026-11-10')).toBe('Last day. GHS 10.00 left to spend.');
  });

  it('says all of it is gone, without scolding', () => {
    expect(line(10_000, '2026-11-04')).toBe('All of it is spent, with 7 days to go.');
    expect(line(10_000, '2026-11-09')).toBe('All of it is spent, with 2 days to go.');
  });

  it('says how far over, with days to go', () => {
    expect(line(10_500, '2026-11-09')).toBe('GHS 5.00 over, with 2 days to go.');
    expect(line(10_500, '2026-11-10')).toBe('GHS 5.00 over, with 1 day to go.');
  });

  it('sums up a finished plan', () => {
    expect(line(8_000, '2026-11-12')).toBe('You finished with GHS 20.00 to spare.');
    expect(line(10_000, '2026-11-12')).toBe('You used the plan to the pesewa.');
    expect(line(11_250, '2026-11-12')).toBe('You finished GHS 12.50 over.');
  });
});
