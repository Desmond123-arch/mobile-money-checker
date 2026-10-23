import { useQuery } from '@tanstack/react-query';

import {
  cashOutBreakdown,
  cashOutLefts,
  openCashOut,
  type CashOutBreakdown,
  type CashOutLeft,
} from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import { useDb } from '@/features/app/DbProvider';

// All three share the `cashOut` prefix, which every ledger write refreshes (`MONEY_KEYS` in `writeGroups.ts`).

/** `null` when the id is not a live cash-out; `undefined` while loading. */
export function useCashOutBreakdown(id: string): CashOutBreakdown | null | undefined {
  const db = useDb();
  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  return useQuery({
    queryKey: ['cashOut', 'breakdown', id],
    queryFn: () => (numeric === null ? null : cashOutBreakdown(db, numeric)),
  }).data;
}

/** What is left of each cash-out in a month, by transaction id. `undefined` while loading. */
export function useCashOutLefts(monthId: string): ReadonlyMap<string, CashOutLeft> | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['cashOut', 'lefts', monthId],
    queryFn: async () =>
      new Map((await cashOutLefts(db, monthRange(monthId))).map((l) => [String(l.id), l])),
  }).data;
}

/** The newest cash-out of the last 30 days with something left to break down, else null. */
export function useOpenCashOut(): { id: number; left: number } | null | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['cashOut', 'open'],
    queryFn: () => openCashOut(db, Date.now()),
  }).data;
}
