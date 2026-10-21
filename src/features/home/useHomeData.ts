import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { monthSummary, recentPayments } from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import { isoDate } from '@/domain/calendar/week';
import type { CategorySpend } from '@/domain/category/share';
import type { MonthSummary } from '@/domain/summary/month';
import type { DatedRow } from '@/domain/transaction/day';
import { useDb } from '@/features/app/DbProvider';
import { useCategorySpend } from '@/features/categories/useCategorySpend';
import { useToday } from '@/features/period';

export const RECENT_COUNT = 3;

export interface HomeData {
  summary: MonthSummary;
  spend: CategorySpend[];
  recent: DatedRow[];
}

/** Everything Home shows for one month, or `undefined` until all three reads have finished. */
export function useHomeData(monthId: string): HomeData | undefined {
  const db = useDb();
  const todayIso = isoDate(useToday());
  const summary = useQuery({
    queryKey: ['summary', monthId, todayIso],
    queryFn: () => monthSummary(db, monthId, todayIso, Date.now()),
    placeholderData: keepPreviousData,
  });
  const recent = useQuery({
    queryKey: ['recent', monthId],
    queryFn: () => recentPayments(db, monthRange(monthId), RECENT_COUNT),
    placeholderData: keepPreviousData,
  });
  const spend = useCategorySpend({ kind: 'month', monthId });

  if (!summary.data || !recent.data || !spend) return undefined;
  return { summary: summary.data, spend, recent: recent.data };
}
