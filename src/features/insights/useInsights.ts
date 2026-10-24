import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  allTimeSummary,
  daySpend,
  monthlyFlows,
  weekdayAverage,
  yearSummary,
  type SpendBreakdown,
} from '@/data/queries';
import type { MonthFlow } from '@/domain/summary/trend';
import type { AllTimeSummary, YearSummary } from '@/domain/summary/year';
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

/** The numbers behind the year view; `undefined` until read. */
export function useYearSummary(year: number): YearSummary | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['flows', 'year', year],
    queryFn: () => yearSummary(db, year),
    placeholderData: keepPreviousData,
  }).data;
}

/** The numbers behind the all-time view; `undefined` until read. */
export function useAllTimeSummary(): AllTimeSummary | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['flows', 'allTime'],
    queryFn: () => allTimeSummary(db),
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
