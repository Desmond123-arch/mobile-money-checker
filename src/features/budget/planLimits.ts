import { limitsProblem, planDays } from '@/domain/budget/plan';
import { fitToTotal } from '@/domain/budget/suggest';
import { formatPlain, parseAmount, pesewas } from '@/domain/money';

import { ghs } from './labels';

export interface LimitRow {
  categoryId: string;
  amountText: string;
}

export interface TotalEntry {
  mode: 'total' | 'daily';
  totalText: string;
  dailyText: string;
  startDay: string;
  endDay: string;
}

/** The plan's total as typed, or the daily amount times the days. Null until it is valid. */
export function resolveTotal(entry: TotalEntry): number | null {
  const typed = parseAmount(entry.mode === 'daily' ? entry.dailyText : entry.totalText);
  if (typed === null) return null;
  const total =
    entry.mode === 'daily' ? typed * planDays(entry.startDay, entry.endDay) : (typed as number);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

/** "GHS 650.00 of GHS 1,000.00 still unplanned", or null while there is no valid total. */
export function limitsLeftCaption(total: number | null, rows: readonly LimitRow[]): string | null {
  if (total === null) return null;
  const used = rows.reduce((sum, r) => sum + (parseAmount(r.amountText) ?? 0), 0);
  return used > total
    ? `${ghs(used - total)} more than the ${ghs(total)} total`
    : `${ghs(total - used)} of ${ghs(total)} still unplanned`;
}

/** Rows for the days-before suggestion; trimmed to the total when it is known. */
export function rowsFromSuggestion(
  limits: readonly { categoryId: string; amount: number }[],
  total: number | null,
): LimitRow[] {
  return (total === null ? limits : fitToTotal(limits, total)).map((l) => ({
    categoryId: l.categoryId,
    amountText: formatPlain(pesewas(l.amount)),
  }));
}

export type LimitsResult =
  { ok: true; limits: { categoryId: string; amount: number }[] } | { ok: false; message: string };

export function buildLimits(
  rows: readonly LimitRow[],
  total: number,
  nameOf: (categoryId: string) => string,
): LimitsResult {
  const limits: { categoryId: string; amount: number }[] = [];
  for (const row of rows) {
    const amount = parseAmount(row.amountText);
    if (amount === null || amount <= 0) {
      return { ok: false, message: `Enter an amount for ${nameOf(row.categoryId)}.` };
    }
    limits.push({ categoryId: row.categoryId, amount });
  }
  const problem = limitsProblem(limits, total);
  return problem === null ? { ok: true, limits } : { ok: false, message: problem };
}
