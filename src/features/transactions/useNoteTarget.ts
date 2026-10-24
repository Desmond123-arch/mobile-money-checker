import { useQuery } from '@tanstack/react-query';

import { needsNoteList } from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import type { Pesewas } from '@/domain/money';
import { relativeDay } from '@/domain/transaction/label';
import { useDb } from '@/features/app/DbProvider';
import { usePeriod, useToday } from '@/features/period';

import { useTransactionDetail } from './useTransactions';

export interface NoteTarget {
  id: string;
  counterparty: string;
  amount: Pesewas;
  /** `Today`, `Yesterday` or `Mon 19 Oct`. */
  when: string;
  categoryId: string | null;
}

/**
 * The payment a sheet asks about: the one named by `id`, else the newest payment in the selected
 * month that still needs a note. `null` when there is none, `undefined` while loading.
 */
export function useNoteTarget(id: string | undefined): NoteTarget | null | undefined {
  const db = useDb();
  const today = useToday();
  const { month } = usePeriod();
  const named = useTransactionDetail(id ?? '');
  const pending = useQuery({
    queryKey: ['needsNote', month.id],
    queryFn: () => needsNoteList(db, monthRange(month.id), Date.now()),
    enabled: id === undefined,
  });

  if (id !== undefined) {
    if (!named) return named;
    return {
      id: named.id,
      counterparty: named.counterparty,
      amount: named.amount,
      when: named.occurredAtLabel.split(' · ')[0] ?? named.occurredAtLabel,
      categoryId: named.categoryId,
    };
  }
  if (!pending.data) return undefined;
  const first = pending.data[0];
  if (!first) return null;
  return {
    id: first.row.id,
    counterparty: first.row.counterparty,
    amount: first.row.amount,
    when: relativeDay(first.iso, today),
    categoryId: first.row.categoryId,
  };
}
