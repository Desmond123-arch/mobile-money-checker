import { useQuery } from '@tanstack/react-query';

import {
  categoryImpact,
  categoryKeywords,
  keywordCounts,
  type CategoryImpact,
  type KeywordRow,
} from '@/data/queries';
import { useDb } from '@/features/app/DbProvider';

/** Words per UI category id; `undefined` until read. */
export function useKeywordCounts(): Record<string, number> | undefined {
  const db = useDb();
  return useQuery({ queryKey: ['keywords', 'counts'], queryFn: () => keywordCounts(db) }).data;
}

export function useCategoryKeywords(categoryId: string): KeywordRow[] | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['keywords', 'words', categoryId],
    queryFn: () => categoryKeywords(db, categoryId),
  }).data;
}

export function useCategoryImpact(categoryId: string): CategoryImpact | null | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['keywords', 'impact', categoryId],
    queryFn: () => categoryImpact(db, categoryId),
  }).data;
}
