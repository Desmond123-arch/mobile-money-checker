import { formatGhs, pesewas } from '../money';
import type { CategoryLine } from './view';

const money = (n: number) => formatGhs(pesewas(n));

export interface Attention {
  categoryId: string;
  tone: 'watch' | 'over';
  /** How far over, or how much is left, in pesewas. */
  amount: number;
}

/**
 * The one category limit worth mentioning on Home: the one furthest over, else the one closest to
 * its limit once it has passed four fifths. Null when every limit is comfortable.
 */
export function attentionOf(lines: readonly CategoryLine[]): Attention | null {
  const over = lines
    .filter((l) => l.progress.tone === 'over')
    .sort((a, b) => b.progress.over - a.progress.over || a.categoryId.localeCompare(b.categoryId));
  const first = over[0];
  if (first) return { categoryId: first.categoryId, tone: 'over', amount: first.progress.over };
  const watch = lines
    .filter((l) => l.progress.tone === 'watch')
    .sort(
      (a, b) =>
        b.progress.fraction - a.progress.fraction || a.categoryId.localeCompare(b.categoryId),
    );
  const close = watch[0];
  return close
    ? { categoryId: close.categoryId, tone: 'watch', amount: close.progress.left }
    : null;
}

/** "Food is over by GHS 12.00." or "Food has GHS 40.00 left." */
export function attentionLine(attention: Attention, name: string): string {
  return attention.tone === 'over'
    ? `${name} is over by ${money(attention.amount)}.`
    : `${name} has ${money(attention.amount)} left.`;
}
