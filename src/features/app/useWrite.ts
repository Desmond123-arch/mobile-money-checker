import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { Db } from '@/data/db';

import { useDb } from './DbProvider';

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

export const SAVE_FAILED = 'Could not save that. Try again.';

/**
 * Runs one ledger write, then invalidates the query prefixes it can change. A recategorising
 * write (keywords, names, categories) changes every total, so it names both groups.
 */
export function useWrite() {
  const db = useDb();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async <T>(
      write: (db: Db) => Promise<T>,
      groups: readonly KeyGroup[],
    ): Promise<{ value: T } | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const value = await write(db);
        await invalidateGroups(client, groups);
        return { value };
      } catch {
        setError(SAVE_FAILED);
        return null;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [db, client],
  );

  return { run, busy, error, setError };
}
