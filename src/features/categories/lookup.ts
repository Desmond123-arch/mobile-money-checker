import { useQuery } from '@tanstack/react-query';

import { listCategories } from '@/data/queries';
import type { Category } from '@/domain/category/category';
import { SEED_CATEGORIES } from '@/domain/category/seed';
import { useDb } from '@/features/app/DbProvider';
import type { IconName } from '@/ui';

export const CATEGORIES_KEY = ['categories'] as const;

// The UI reads categories synchronously (rows, legends), so the last list the database gave is
// kept here. It starts as the seed so system categories resolve before the first read. Screens
// that show categories call useCategories(), which re-renders them when the list changes.
let current: readonly Category[] = SEED_CATEGORIES;

export function categoryById(id: string | null): Category | null {
  return id === null ? null : (current.find((c) => c.id === id) ?? null);
}

/** Categories in display order. Invalidate CATEGORIES_KEY after adding, renaming or deleting one. */
export function useCategories(): readonly Category[] {
  const db = useDb();
  const { data } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async () => {
      current = await listCategories(db);
      return current;
    },
    staleTime: Infinity,
  });
  return data ?? current;
}

const ICONS: Record<string, IconName> = {
  food: 'fork',
  transport: 'car',
  family: 'people',
  friends: 'people',
  health: 'plus',
  income: 'arrowIn',
};

export function categoryIcon(id: string | null): IconName {
  return (id !== null && ICONS[id]) || 'tag';
}
