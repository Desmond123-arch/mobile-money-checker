const DAY_MS = 86_400_000;
const NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface TimeRange {
  /** Inclusive, epoch ms UTC. */
  start: number;
  /** Exclusive. */
  end: number;
}

/** A month id is `YYYY-MM` in UTC. */
const parts = (id: string): [number, number] => {
  const [year = 1970, month = 1] = id.split('-').map(Number);
  return [year, month - 1];
};

export const monthIdOf = (date: Date): string => date.toISOString().slice(0, 7);

export function monthRange(id: string): TimeRange {
  const [year, index] = parts(id);
  return { start: Date.UTC(year, index, 1), end: Date.UTC(year, index + 1, 1) };
}

export function dayRange(iso: string): TimeRange {
  const start = Date.parse(`${iso}T00:00:00Z`);
  return { start, end: start + DAY_MS };
}

export function daysInMonth(id: string): number {
  const range = monthRange(id);
  return Math.round((range.end - range.start) / DAY_MS);
}

export function addMonths(id: string, delta: number): string {
  const [year, index] = parts(id);
  return monthIdOf(new Date(Date.UTC(year, index + delta, 1)));
}

export const monthName = (id: string): string => NAMES[parts(id)[1]] ?? '';

export const monthShort = (id: string): string => monthName(id).slice(0, 3);

export const monthLabel = (id: string): string => `${monthName(id)} ${parts(id)[0]}`;

/** How many days of weekday `weekday` (0 = Sunday) fall between two instants, counted by UTC date. */
export function countWeekdays(startMs: number, endMs: number, weekday: number): number {
  const first = Math.floor(startMs / DAY_MS);
  const last = Math.floor(endMs / DAY_MS);
  let count = 0;
  for (let day = first; day <= last; day += 1) {
    // Day 0 (1 Jan 1970) was a Thursday.
    if ((day + 4) % 7 === weekday) count += 1;
  }
  return count;
}
