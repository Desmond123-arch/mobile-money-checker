import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { Db } from '@/data/db';

import { useDb } from './DbProvider';
import { invalidateGroups, splitGroups, type KeyGroup } from './writeGroups';

export const SAVE_FAILED = 'Could not save that. Try again.';

type Groups<T> = readonly KeyGroup[] | ((value: T) => readonly KeyGroup[]);

interface WriteOptions {
  /**
   * Let a second write start while one is running. The ledger queue still runs them one at a
   * time, so nothing interleaves; without this a second tap is ignored. Use it for lists of
   * small edits (names, words), where ignoring a tap loses the user's work.
   */
  overlap?: boolean;
}

/**
 * Runs one ledger write, then refreshes what it can have changed. `groups` is a list, or a
 * function of what the write returned, so an edit that moved no payment can leave the money
 * screens alone. The settings lists are what the screen shows next, so they are awaited; the
 * money screens refresh in the background so a save never waits on a reload of every tab.
 */
export function useWrite({ overlap = false }: WriteOptions = {}) {
  const db = useDb();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const inFlight = useRef(0);

  const run = useCallback(
    async <T>(write: (db: Db) => Promise<T>, groups: Groups<T>): Promise<{ value: T } | null> => {
      if (!overlap && inFlight.current > 0) return null;
      inFlight.current += 1;
      setPending((n) => n + 1);
      setError(null);
      try {
        const value = await write(db);
        const needed = typeof groups === 'function' ? groups(value) : groups;
        const { wait, background } = splitGroups(needed);
        void invalidateGroups(client, background).catch(() => undefined);
        await invalidateGroups(client, wait);
        return { value };
      } catch {
        setError(SAVE_FAILED);
        return null;
      } finally {
        inFlight.current -= 1;
        setPending((n) => n - 1);
      }
    },
    [db, client, overlap],
  );

  return { run, busy: pending > 0, error, setError };
}
