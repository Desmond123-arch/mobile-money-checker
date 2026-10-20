import type { Pesewas } from '../money';

export interface CategorySpend {
  categoryId: string;
  amount: Pesewas;
}

export interface CategoryShare extends CategorySpend {
  percent: number;
}

export function categoryShares(spend: readonly CategorySpend[]): CategoryShare[] {
  const total = spend.reduce((sum, s) => sum + s.amount, 0);
  if (total === 0) return [];
  return [...spend]
    .sort((a, b) => b.amount - a.amount)
    .map((s) => ({ ...s, percent: Math.round((s.amount * 100) / total) }));
}

export function allocate(
  total: Pesewas,
  weights: Readonly<Record<string, number>>,
): CategorySpend[] {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const weightSum = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0 || weightSum === 0) return [];

  const parts = entries.map(([categoryId, weight]) => {
    const exact = (total * weight) / weightSum;
    return { categoryId, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let leftover = total - parts.reduce((sum, p) => sum + p.floor, 0);
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder);
  for (const part of byRemainder) {
    if (leftover === 0) break;
    part.floor += 1;
    leftover -= 1;
  }
  return parts.map((p) => ({ categoryId: p.categoryId, amount: p.floor as Pesewas }));
}
