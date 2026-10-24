import { paceOf } from '../progress';
import { standingOf, todayOf } from '../standing';

const daily = { startDay: '2026-11-01', endDay: '2026-11-10', total: 50_000, daily: 5_000 };

describe('perDay and cushion', () => {
  it('uses the stated daily amount, else the total over the days', () => {
    expect(paceOf(daily, 0, '2026-11-03').perDay).toBe(5_000);
    expect(paceOf({ ...daily, daily: null, total: 10_001 }, 0, '2026-11-03').perDay).toBe(1_000);
  });

  it('allows a whole day more each morning', () => {
    expect(paceOf(daily, 0, '2026-11-01').cushion).toBe(5_000);
    expect(paceOf(daily, 0, '2026-11-04').cushion).toBe(20_000);
    expect(paceOf(daily, 17_000, '2026-11-04').cushion).toBe(3_000);
    expect(paceOf(daily, 23_000, '2026-11-04').cushion).toBe(-3_000);
  });

  it('has no cushion before the plan, and the whole total left after it', () => {
    expect(paceOf(daily, 0, '2026-10-30')).toMatchObject({ cushion: 0, perDay: 5_000 });
    expect(paceOf(daily, 41_000, '2026-11-11').cushion).toBe(9_000);
    expect(paceOf(daily, 60_000, '2026-11-11').cushion).toBe(-10_000);
  });

  it('treats a net refund as nothing spent', () => {
    expect(paceOf(daily, -500, '2026-11-02').cushion).toBe(10_000);
  });
});

describe('standingOf', () => {
  const standing = (spent: number, today: string) => standingOf(paceOf(daily, spent, today));

  it('is safe while spending is under the daily pace so far', () => {
    expect(standing(17_000, '2026-11-04')).toEqual({
      status: 'safe',
      amount: 3_000,
      line: 'Safe. GHS 30.00 under GHS 50.00 a day.',
    });
  });

  it('is safe, not behind, when exactly on pace', () => {
    expect(standing(20_000, '2026-11-04')).toMatchObject({
      status: 'safe',
      amount: 0,
      line: 'Safe. Right on GHS 50.00 a day.',
    });
  });

  it('is behind once spending passes the pace', () => {
    expect(standing(23_500, '2026-11-04')).toEqual({
      status: 'behind',
      amount: 3_500,
      line: 'Behind by GHS 35.00 against GHS 50.00 a day.',
    });
  });

  it('gives a morning with nothing spent a full day of room', () => {
    expect(standing(0, '2026-11-01')?.status).toBe('safe');
  });

  it('has no standing before or after the plan', () => {
    expect(standing(0, '2026-10-30')).toBeNull();
    expect(standing(0, '2026-11-11')).toBeNull();
  });
});

describe('todayOf', () => {
  const today = (spent: number, day = '2026-11-04') => todayOf(paceOf(daily, 0, day), spent);

  it('shows today against the daily amount', () => {
    expect(today(2_000)).toEqual({
      spent: 2_000,
      allowance: 5_000,
      left: 3_000,
      over: 0,
      line: 'Today: GHS 20.00 of GHS 50.00.',
    });
  });

  it('says how far over', () => {
    expect(today(6_200)).toMatchObject({
      left: 0,
      over: 1_200,
      line: 'Today: GHS 62.00, GHS 12.00 over GHS 50.00.',
    });
  });

  it('is exactly the amount on the line, not over', () => {
    expect(today(5_000)).toMatchObject({
      left: 0,
      over: 0,
      line: 'Today: GHS 50.00 of GHS 50.00.',
    });
  });

  it('floors a net refund at zero and is absent outside the plan', () => {
    expect(today(-300)?.spent).toBe(0);
    expect(today(100, '2026-11-12')).toBeNull();
    expect(today(100, '2026-10-30')).toBeNull();
  });
});
