// Hand-added expenses still live in memory (ExpensesProvider). This is the one place that folds
// them into what the database returns. When they become `origin = 'manual'` rows the queries
// already include them: delete this file and its callers.
import { isoDate } from '@/domain/calendar/week';
import type { CategorySpend } from '@/domain/category/share';
import { pesewas } from '@/domain/money';
import type { MonthSummary } from '@/domain/summary/month';
import type { DatedRow } from '@/domain/transaction/day';
import { relativeDay } from '@/domain/transaction/label';
import type {
  Direction,
  TransactionDetail,
  TransactionRow,
} from '@/domain/transaction/transaction';

import type { AddedExpense } from './ExpensesProvider';

const DAY_MS = 86_400_000;

export const addedIso = (day: AddedExpense['day'], today: Date): string =>
  isoDate(day === 'today' ? today : new Date(today.getTime() - DAY_MS));

export function mergeSummary(base: MonthSummary, added: readonly AddedExpense[]): MonthSummary {
  const total = added.reduce((sum, a) => sum + a.row.amount, 0);
  return { ...base, spent: pesewas(base.spent + total), payments: base.payments + added.length };
}

export function mergeSpend(
  spend: readonly CategorySpend[],
  added: readonly AddedExpense[],
): CategorySpend[] {
  const merged = new Map(spend.map((s) => [s.categoryId, s.amount as number]));
  for (const { row } of added) {
    const id = row.categoryId ?? 'other';
    merged.set(id, (merged.get(id) ?? 0) + row.amount);
  }
  return [...merged].map(([categoryId, amount]) => ({ categoryId, amount: pesewas(amount) }));
}

export interface RowFilter {
  direction: Direction | null;
  categoryId: string | null;
  search: string;
  categoryName: (id: string | null) => string;
}

/** The same direction, category and search rules the SQL applies to stored rows. */
export function matchesFilter(row: TransactionRow, f: RowFilter): boolean {
  if (f.direction !== null && row.direction !== f.direction) return false;
  if (f.categoryId !== null && row.categoryId !== f.categoryId) return false;
  const needle = f.search.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = `${row.counterparty} ${row.note ?? ''} ${f.categoryName(row.categoryId)}`;
  return haystack.toLowerCase().includes(needle);
}

/** Added expenses first within their day, then the stored rows; still newest day first. */
export function mergeRows(
  rows: readonly DatedRow[],
  added: readonly AddedExpense[],
  today: Date,
  keep: (row: TransactionRow) => boolean,
): DatedRow[] {
  const mine = added
    .filter((a) => keep(a.row))
    .map((a) => ({ iso: addedIso(a.day, today), row: a.row }));
  return [...mine, ...rows].sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
}

export interface RecentRow {
  row: TransactionRow;
  when: string;
}

export function recentWithAdded(
  rows: readonly DatedRow[],
  added: readonly AddedExpense[],
  today: Date,
  limit: number,
): RecentRow[] {
  return mergeRows(rows, added, today, () => true)
    .slice(0, limit)
    .map(({ iso, row }) => ({ row, when: relativeDay(iso, today) }));
}

export function detailOfAdded(expense: AddedExpense, today: Date): TransactionDetail {
  return {
    ...expense.row,
    occurredAtLabel: relativeDay(addedIso(expense.day, today), today),
    timeApproximate: false,
    kindLabel: 'Added by you.',
    balanceAfter: null,
    noteSource: null,
    originalMessage: null,
    reversed: false,
    reversesId: null,
  };
}
