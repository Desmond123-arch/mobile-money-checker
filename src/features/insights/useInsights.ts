import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { daySpend, monthlyFlows, weekdayAverage, type SpendBreakdown } from '@/data/queries';
import type { MonthFlow } from '@/domain/summary/trend';
import { useDb } from '@/features/app/DbProvider';

/** Money out and in for the six months ending at `endMonthId`; `undefined` until read. */
export function useMonthlyFlows(endMonthId: string): MonthFlow[] | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['flows', endMonthId],
    queryFn: () => monthlyFlows(db, endMonthId, 6),
    placeholderData: keepPreviousData,
  }).data;
}

/** What was spent on one day, by category. Only runs for a day that has started. */
export function useDaySpend(iso: string, enabled: boolean): SpendBreakdown | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['daySpend', iso],
    queryFn: () => daySpend(db, iso),
    enabled,
  }).data;
}

/** An average day of this weekday (0 = Sunday), for a day that has not happened yet. */
export function useWeekdayAverage(weekday: number, enabled: boolean): SpendBreakdown | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['weekdayAverage', weekday],
    queryFn: () => weekdayAverage(db, weekday),
    enabled,
  }).data;
}
