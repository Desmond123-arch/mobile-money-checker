import type { Category } from '@/domain/category/category';
import { SEED_CATEGORIES } from '@/domain/category/seed';
import type { IconName } from '@/ui';

const BY_ID = new Map(SEED_CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id: string | null): Category | null {
  return id === null ? null : (BY_ID.get(id) ?? null);
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
