import { useQuery } from '@tanstack/react-query';

import { yearsWithData } from '@/data/queries';
import { useDb } from '@/features/app/DbProvider';

const NONE: readonly number[] = [];

/** Every year that has at least one ledger line, oldest first. */
export function useYearsWithData(): readonly number[] {
  const db = useDb();
  const { data } = useQuery({
    queryKey: ['months', 'years'],
    queryFn: async () => (await yearsWithData(db)).map((y) => y.year),
  });
  return data ?? NONE;
}
