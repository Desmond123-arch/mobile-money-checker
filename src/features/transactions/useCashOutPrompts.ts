import { useQuery } from '@tanstack/react-query';

import { cashOutPrompts } from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import type { DatedRow } from '@/domain/transaction/day';
import { useDb } from '@/features/app/DbProvider';

/**
 * The cash-outs still asking "What was this for?" in a month, newest first: after the first
 * import, unanswered and not snoozed. `undefined` while loading. Shares the `needsNote` key prefix
 * so every ledger write refreshes it.
 */
export function useCashOutPrompts(monthId: string): DatedRow[] | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['needsNote', 'cashOut', monthId],
    queryFn: () => cashOutPrompts(db, monthRange(monthId), Date.now()),
  }).data;
}
