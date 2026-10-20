import { isoDate, weekDays } from '../calendar/week';

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
