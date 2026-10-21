import type { Pesewas } from '../money';

export type Direction = 'up' | 'down' | 'same';

export interface Comparison {
  direction: Direction;
  /** Whole percent, always positive; 0 when the direction is `same`. */
  percent: number;
  text: string;
}

/** How far `current` is from `previous`, in whole percent (negative when lower); null when there is no base to measure from. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * "12% more than 2025", pointing the way the money moved. Null when the earlier period spent
 * nothing, since a percentage of zero says nothing.
 */
export function compareSpend(
  current: Pesewas,
  previous: Pesewas | null,
  previousLabel: string,
): Comparison | null {
  const change = previous === null ? null : percentChange(current, previous);
  if (change === null) return null;
  if (change === 0) {
    return { direction: 'same', percent: 0, text: `About the same as ${previousLabel}` };
  }
  const direction: Direction = change > 0 ? 'up' : 'down';
  const percent = Math.abs(change);
  return {
    direction,
    percent,
    text: `${percent}% ${direction === 'up' ? 'more' : 'less'} than ${previousLabel}`,
  };
}
