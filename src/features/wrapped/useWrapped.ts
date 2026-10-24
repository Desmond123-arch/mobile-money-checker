import { useQuery } from '@tanstack/react-query';

import { wrappedFacts } from '@/data/queries';
import { buildWrapped, type WrappedScope, type WrappedSlide } from '@/domain/summary/wrapped';
import { useDb } from '@/features/app/DbProvider';

/** The slides for a scope; `undefined` while the numbers are read, an empty list when there is nothing to recap. */
export function useWrapped(scope: WrappedScope | null): WrappedSlide[] | undefined {
  const db = useDb();
  const { data } = useQuery({
    queryKey: ['wrapped', scope?.kind, scope?.kind === 'year' ? scope.year : null],
    queryFn: async () => (scope ? buildWrapped(await wrappedFacts(db, scope)) : []),
  });
  return data;
}
