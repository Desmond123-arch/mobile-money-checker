import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { categorySpend } from '@/data/queries';
import { dayRange, monthRange, type TimeRange } from '@/domain/calendar/month';
import { ALL_TIME, yearRange } from '@/domain/calendar/year';
import type { CategorySpend } from '@/domain/category/share';
import { useDb } from '@/features/app/DbProvider';

export type SpendScope =
  | { kind: 'month'; monthId: string }
  | { kind: 'day'; iso: string }
  | { kind: 'year'; year: number }
  | { kind: 'all' };

function rangeOf(scope: SpendScope): TimeRange {
  switch (scope.kind) {
    case 'month':
      return monthRange(scope.monthId);
    case 'day':
      return dayRange(scope.iso);
    case 'year':
      return yearRange(scope.year);
    case 'all':
      return ALL_TIME;
  }
}

/** Net spend per category for a day, month, year or everything; `undefined` while it loads. */
export function useCategorySpend(scope: SpendScope): CategorySpend[] | undefined {
  const db = useDb();
  const range = rangeOf(scope);
  const { data } = useQuery({
    queryKey: ['categorySpend', scope.kind, range.start, range.end],
    queryFn: () => categorySpend(db, range),
    placeholderData: keepPreviousData,
  });
  return data;
}
