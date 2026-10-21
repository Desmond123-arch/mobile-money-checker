import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { categorySpend } from '@/data/queries';
import { dayRange, monthRange } from '@/domain/calendar/month';
import type { CategorySpend } from '@/domain/category/share';
import { useDb } from '@/features/app/DbProvider';

export type SpendScope = { kind: 'month'; monthId: string } | { kind: 'day'; iso: string };

/** Net spend per category for a month or a single day; `undefined` while it loads. */
export function useCategorySpend(scope: SpendScope): CategorySpend[] | undefined {
  const db = useDb();
  const key = scope.kind === 'month' ? scope.monthId : scope.iso;
  const { data } = useQuery({
    queryKey: ['categorySpend', scope.kind, key],
    queryFn: () =>
      categorySpend(db, scope.kind === 'month' ? monthRange(scope.monthId) : dayRange(scope.iso)),
    placeholderData: keepPreviousData,
  });
  return data;
}
