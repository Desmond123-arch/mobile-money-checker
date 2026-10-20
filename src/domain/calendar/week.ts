export type DayState = 'past' | 'today' | 'future';

export interface WeekDay {
  label: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  name: string;
  iso: string;
  short: string;
  state: DayState;
}

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const startOfUtcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekDays(today: Date): WeekDay[] {
  const todayStart = startOfUtcDay(today);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const mondayStart = todayStart - sinceMonday * DAY_MS;

  return LABELS.map((label, index) => {
    const start = mondayStart + index * DAY_MS;
    const date = new Date(start);
    const state: DayState = start < todayStart ? 'past' : start === todayStart ? 'today' : 'future';
    return {
      label,
      name: NAMES[index] ?? label,
      iso: isoDate(date),
      short: `${label} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`,
      state,
    };
  });
}
