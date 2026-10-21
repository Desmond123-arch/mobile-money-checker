import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { monthsWithData } from '@/data/queries';
import { monthIdOf } from '@/domain/calendar/month';
import { useDb } from '@/features/app/DbProvider';

import { buildMonthOptions, defaultMonthId, type MonthOption } from './months';
import { useToday } from './useToday';

export interface MonthOptions {
  /** Oldest first. */
  options: readonly MonthOption[];
  currentId: string;
  /** The month Home and Insights open on until the user picks one. */
  defaultId: string;
  /** Whether any month has data. */
  hasData: boolean;
  /** False until the first read finishes. */
  ready: boolean;
}

export function useMonthOptions(): MonthOptions {
  const db = useDb();
  const currentId = monthIdOf(useToday());
  const { data } = useQuery({ queryKey: ['months'], queryFn: () => monthsWithData(db) });

  return useMemo(() => {
    const totals = data ?? [];
    return {
      options: buildMonthOptions(totals, currentId),
      currentId,
      defaultId: defaultMonthId(
        totals.map((t) => t.monthId),
        currentId,
      ),
      hasData: totals.length > 0,
      ready: data !== undefined,
    };
  }, [data, currentId]);
}
