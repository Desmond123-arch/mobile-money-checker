import { paceOf, progressOf } from '@/domain/budget/progress';

import {
  barLabel,
  dailyTimesDays,
  heroOf,
  periodSummary,
  planLabel,
  rowRight,
  settingsSubtitle,
  standingChip,
  statusChip,
} from '../labels';

const nov = { startDay: '2026-11-01', endDay: '2026-11-30', total: 100_000 };

describe('planLabel', () => {
  it('prefers the name', () => {
    expect(planLabel({ ...nov, name: 'November' })).toBe('November');
  });

  it('falls back to the dates without weekdays', () => {
    expect(planLabel({ ...nov, name: null })).toBe('1 Nov to 30 Nov');
  });
});

describe('periodSummary', () => {
  it('counts the days', () => {
    expect(periodSummary('2026-11-07', '2026-11-13', '2026-11-02')).toBe('Sat 7 Nov · 7 days');
    expect(periodSummary('2026-11-07', '2026-11-07', '2026-11-07')).toBe('Sat 7 Nov · 1 day');
  });

  it('says what a past start counts', () => {
    expect(periodSummary('2026-11-02', '2026-11-08', '2026-11-05')).toBe(
      'Mon 2 Nov · 7 days. Counts what you already spent since Mon 2 Nov.',
    );
  });
});

describe('settingsSubtitle', () => {
  it('invites a plan when there is none', () => {
    expect(settingsSubtitle(null, '2026-11-05')).toBe('Plan how much to spend');
  });

  it('shows what is left while active, or the overshoot', () => {
    expect(settingsSubtitle({ ...nov, spent: 36_000 }, '2026-11-05')).toBe(
      '1 Nov to 30 Nov · GHS 640.00 left',
    );
    expect(settingsSubtitle({ ...nov, spent: 101_200 }, '2026-11-05')).toBe(
      '1 Nov to 30 Nov · GHS 12.00 over',
    );
  });

  it('names the start of an upcoming plan and the end of a finished one', () => {
    expect(settingsSubtitle({ ...nov, spent: 0 }, '2026-10-20')).toBe('Starts Sun 1 Nov');
    expect(settingsSubtitle({ ...nov, spent: 5 }, '2026-12-02')).toBe('Last plan ended 30 Nov');
  });
});

describe('statusChip', () => {
  it('reads the pace', () => {
    expect(statusChip(paceOf(nov, 0, '2026-11-05'))).toBe('Day 5 of 30');
    expect(statusChip(paceOf(nov, 0, '2026-10-29'))).toBe('Starts in 3 days');
    expect(statusChip(paceOf(nov, 0, '2026-10-31'))).toBe('Starts tomorrow');
    expect(statusChip(paceOf(nov, 0, '2026-12-01'))).toBe('Ended');
  });
});

describe('rowRight', () => {
  it('says left or over', () => {
    expect(rowRight(progressOf(10_000, 6_000))).toBe('GHS 40.00 left');
    expect(rowRight(progressOf(10_000, 11_200))).toBe('GHS 12.00 over');
  });
});

describe('heroOf and barLabel', () => {
  it('switches to over', () => {
    const pace = paceOf(nov, 0, '2026-11-05');
    expect(heroOf(progressOf(100_000, 43_000), pace)).toEqual({
      label: 'Left',
      amount: 57_000,
      over: false,
    });
    expect(heroOf(progressOf(100_000, 110_000), pace)).toEqual({
      label: 'Over by',
      amount: 10_000,
      over: true,
    });
    expect(heroOf(progressOf(100_000, 40_000), paceOf(nov, 0, '2026-12-05')).label).toBe(
      'Finished with',
    );
  });

  it('spells the bar out', () => {
    expect(barLabel(progressOf(100_000, 43_000), paceOf(nov, 43_000, '2026-11-05'))).toBe(
      'GHS 430.00 of GHS 1,000.00 spent, day 5 of 30',
    );
  });
});

describe('dailyTimesDays', () => {
  it('shows the product', () => {
    expect(dailyTimesDays(5_000, '2026-11-01', '2026-11-30')).toBe(
      'GHS 50.00 × 30 days = GHS 1,500.00',
    );
    expect(dailyTimesDays(5_000, '2026-11-01', '2026-11-01')).toBe('GHS 50.00 × 1 day = GHS 50.00');
  });
});

describe('standingChip', () => {
  it('names the side', () => {
    const base = { amount: 0, line: '' };
    expect(standingChip({ ...base, status: 'safe' })).toBe('Safe');
    expect(standingChip({ ...base, status: 'behind' })).toBe('Behind');
  });
});
