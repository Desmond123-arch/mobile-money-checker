import type { QueryClient } from '@tanstack/react-query';

/** Query key prefixes that read money rows: totals, lists, detail, charts, months, needs-a-note. */
export const MONEY_KEYS = [
  'summary',
  'recent',
  'categorySpend',
  'transactions',
  'transaction',
  'flows',
  'daySpend',
  'weekdayAverage',
  'months',
  'needsNote',
  'cashOut',
  'budget',
] as const;

/** Prefixes that read categoriser settings and the unread list. */
export const SETTINGS_KEYS = ['categories', 'keywords', 'names', 'unread'] as const;

export type KeyGroup = 'money' | 'settings';

const GROUPS: Record<KeyGroup, readonly string[]> = {
  money: MONEY_KEYS,
  settings: SETTINGS_KEYS,
};

export function invalidateGroups(
  client: QueryClient,
  groups: readonly KeyGroup[],
): Promise<void[]> {
  return Promise.all(
    groups.flatMap((g) => GROUPS[g]).map((key) => client.invalidateQueries({ queryKey: [key] })),
  );
}

/** What a save waits for (the settings lists the screen shows next) and what refreshes behind it. */
export function splitGroups(needed: readonly KeyGroup[]): {
  wait: readonly KeyGroup[];
  background: readonly KeyGroup[];
} {
  return {
    wait: needed.filter((g) => g === 'settings'),
    background: needed.filter((g) => g !== 'settings'),
  };
}
