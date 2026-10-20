import type { Pesewas } from '../money';

export interface CategorySpend {
  categoryId: string;
  amount: Pesewas;
}

export interface CategoryShare extends CategorySpend {
  /** Whole percent of the total, rounded to nearest. */
  percent: number;
}

/** Largest first, each with its whole-percent share of the total. */
export function categoryShares(spend: readonly CategorySpend[]): CategoryShare[] {
  const total = spend.reduce((sum, s) => sum + s.amount, 0);
  if (total === 0) return [];
  return [...spend]
    .sort((a, b) => b.amount - a.amount)
    .map((s) => ({ ...s, percent: Math.round((s.amount * 100) / total) }));
}
