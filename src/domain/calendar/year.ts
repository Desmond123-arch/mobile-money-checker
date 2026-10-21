import type { TimeRange } from './month';

/** Every instant the app can hold: from the epoch to the last moment a `Date` can name. */
export const ALL_TIME: TimeRange = { start: 0, end: 8_640_000_000_000_000 };

export function yearRange(year: number): TimeRange {
  return { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
}

/** `2026-01` to `2026-12`. */
export const yearMonthIds = (year: number): string[] =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

export const yearOfMonth = (monthId: string): number => Number(monthId.slice(0, 4));
