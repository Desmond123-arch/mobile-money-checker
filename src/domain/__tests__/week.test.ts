import {
  dayState,
  isoDate,
  longDate,
  monthGrid,
  shortDate,
  weekDays,
  weekdayLabel,
  weekdayName,
} from '../calendar/week';

describe('weekDays', () => {
  const tuesday = new Date('2026-10-20T14:30:00Z');

  it('runs Monday to Sunday around the given day', () => {
    const days = weekDays(tuesday);
    expect(days.map((d) => d.iso)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(days[4]).toMatchObject({ label: 'Fri', name: 'Friday', short: 'Fri 23 Oct' });
  });

  it('marks days before, on and after today', () => {
    const states = weekDays(tuesday).map((d) => d.state);
    expect(states).toEqual(['past', 'today', 'future', 'future', 'future', 'future', 'future']);
  });

  it('treats Sunday as the last day of its week', () => {
    const days = weekDays(new Date('2026-10-25T23:59:00Z'));
    expect(days[0]?.iso).toBe('2026-10-19');
    expect(days.map((d) => d.state)).toEqual([
      'past',
      'past',
      'past',
      'past',
      'past',
      'past',
      'today',
    ]);
  });

  it('crosses a month boundary', () => {
    const days = weekDays(new Date('2026-11-02T08:00:00Z'));
    expect(days[0]?.short).toBe('Mon 2 Nov');
    const earlier = weekDays(new Date('2026-10-01T08:00:00Z'));
    expect(earlier[0]?.short).toBe('Mon 28 Sep');
  });
});

describe('isoDate', () => {
  it('formats a UTC date', () => {
    expect(isoDate(new Date('2026-03-05T23:00:00Z'))).toBe('2026-03-05');
  });
});

describe('dayState', () => {
  const today = new Date('2026-10-20T10:00:00Z');
  it('compares an ISO date with today', () => {
    expect(dayState('2026-10-19', today)).toBe('past');
    expect(dayState('2026-10-20', today)).toBe('today');
    expect(dayState('2026-10-21', today)).toBe('future');
  });
});

describe('date labels', () => {
  it('names the weekday and formats the date', () => {
    expect(weekdayLabel('2026-10-23')).toBe('Fri');
    expect(weekdayLabel('2026-10-25')).toBe('Sun');
    expect(weekdayName('2026-10-19')).toBe('Monday');
    expect(shortDate('2026-10-23')).toBe('Fri 23 Oct');
    expect(longDate('2026-10-20')).toBe('Tuesday 20 Oct');
  });
});

describe('monthGrid', () => {
  it('pads to whole Monday-first weeks', () => {
    const rows = monthGrid(2026, 9);
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(rows[0]?.[3]).toEqual({ iso: '2026-10-01', day: 1 });
    const last = rows[rows.length - 1]?.filter(Boolean).pop();
    expect(last).toEqual({ iso: '2026-10-31', day: 31 });
  });

  it('handles a month that starts on Monday', () => {
    const rows = monthGrid(2026, 5);
    expect(rows[0]?.[0]).toEqual({ iso: '2026-06-01', day: 1 });
  });

  it('counts every day exactly once', () => {
    const days = monthGrid(2026, 1).flat().filter(Boolean);
    expect(days).toHaveLength(28);
  });
});
