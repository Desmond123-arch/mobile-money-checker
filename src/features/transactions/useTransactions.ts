import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listTransactions, transactionDetail } from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import { isoDate } from '@/domain/calendar/week';
import type { DatedRow } from '@/domain/transaction/day';
import type { Direction, TransactionDetail } from '@/domain/transaction/transaction';
import { useDb } from '@/features/app/DbProvider';
import { useToday } from '@/features/period';

export interface TransactionQuery {
  monthId: string;
  direction: Direction | null;
  categoryId: string | null;
  search: string;
}

/** Stored transactions in a month, newest first; `undefined` until the first read. */
export function useTransactions(q: TransactionQuery): DatedRow[] | undefined {
  const db = useDb();
  const search = q.search.trim();
  return useQuery({
    queryKey: ['transactions', q.monthId, q.direction, q.categoryId, search],
    queryFn: () =>
      listTransactions(db, {
        range: monthRange(q.monthId),
        direction: q.direction,
        categoryId: q.categoryId,
        search,
      }),
    placeholderData: keepPreviousData,
  }).data;
}

/** `null` when the id is not a stored transaction; `undefined` while loading. */
export function useTransactionDetail(id: string): TransactionDetail | null | undefined {
  const db = useDb();
  const today = useToday();
  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  return useQuery({
    queryKey: ['transaction', id, isoDate(today)],
    queryFn: () => (numeric === null ? null : transactionDetail(db, numeric, today)),
  }).data;
}
