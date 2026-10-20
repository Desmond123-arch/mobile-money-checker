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

const pick = <T>(items: readonly T[], index: number): T => items[index] as T;

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
      name: pick(NAMES, index),
      iso: isoDate(date),
      short: `${label} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`,
      state,
    };
  });
}

export function dayState(iso: string, today: Date): DayState {
  const todayIso = isoDate(today);
  return iso < todayIso ? 'past' : iso === todayIso ? 'today' : 'future';
}

export function weekdayLabel(iso: string): WeekDay['label'] {
  const index = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return pick(LABELS, index);
}

export function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return `${weekdayLabel(iso)} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function longDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const name = pick(NAMES, (date.getUTCDay() + 6) % 7);
  return `${name} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function weekdayName(iso: string): string {
  return pick(NAMES, (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7);
}

export interface CalendarCell {
  iso: string;
  day: number;
}

export function monthGrid(year: number, monthIndex: number): (CalendarCell | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (CalendarCell | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push({ iso: isoDate(new Date(Date.UTC(year, monthIndex, day))), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
