import type { Db } from '../db';
import { isoDate } from '@/domain/calendar/week';
import type { TimeRange } from '@/domain/calendar/month';
import { pesewas } from '@/domain/money';
import type { DatedRow } from '@/domain/transaction/day';
import { fallbackCounterparty, kindLabel, occurredAtLabel } from '@/domain/transaction/label';
import type { Direction, TransactionDetail } from '@/domain/transaction/transaction';

import { inRange, likePattern, UI_CATEGORY_ID_SQL } from './sql';

export interface ListRow {
  id: number;
  kind: string;
  origin: 'sms' | 'manual';
  direction: Direction;
  amount_pesewas: number;
  counterparty: string | null;
  note: string | null;
  category_id: string;
  occurred_at: number;
}

export const ROW_COLUMNS = `l.id, l.kind, l.origin, l.direction, l.amount_pesewas, l.counterparty,
  l.note, l.occurred_at, ${UI_CATEGORY_ID_SQL} AS category_id`;

export function mapRow(r: ListRow): DatedRow {
  return {
    iso: isoDate(new Date(r.occurred_at)),
    row: {
      id: String(r.id),
      counterparty: r.counterparty ?? fallbackCounterparty(r.kind),
      categoryId: r.category_id,
      note: r.note,
      direction: r.direction,
      amount: pesewas(r.amount_pesewas),
      ...(r.origin === 'manual' ? { manual: true } : {}),
    },
  };
}

export interface TransactionFilters {
  range?: TimeRange;
  direction?: Direction | null;
  /** UI category id, e.g. `food`, `other` or `12`. */
  categoryId?: string | null;
  /** Matches the name, the note or the category name, ignoring case (ASCII). */
  search?: string;
}

/** Newest first. Credits count as money in. */
export async function listTransactions(
  db: Db,
  filters: TransactionFilters = {},
  limit = -1,
): Promise<DatedRow[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters.range) {
    const time = inRange('l.occurred_at', filters.range);
    clauses.push(time.sql);
    params.push(...time.params);
  }
  if (filters.direction) {
    clauses.push('l.direction = ?');
    params.push(filters.direction);
  }
  if (filters.categoryId) {
    clauses.push(`${UI_CATEGORY_ID_SQL} = ?`);
    params.push(filters.categoryId);
  }
  const needle = filters.search?.trim();
  if (needle) {
    const pattern = likePattern(needle);
    clauses.push(
      `(l.counterparty LIKE ? ESCAPE '\\' OR l.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')`,
    );
    params.push(pattern, pattern, pattern);
  }
  const rows = await db.all<ListRow>(
    `SELECT ${ROW_COLUMNS}
     FROM transaction_list l JOIN categories c ON c.id = l.category_id
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY l.occurred_at DESC, l.id DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map(mapRow);
}

/** The latest payments (money out), newest first. */
export const recentPayments = (db: Db, range: TimeRange, limit: number): Promise<DatedRow[]> =>
  listTransactions(db, { range, direction: 'out' }, limit);

/** Outgoing payments in the range, for "See all N". Matches the Home payments count. */
export async function paymentCount(db: Db, range: TimeRange): Promise<number> {
  const time = inRange('occurred_at', range);
  const row = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions
     WHERE flow = 'spend' AND retracted_at IS NULL AND ${time.sql}`,
    time.params,
  );
  return row?.n ?? 0;
}

interface DetailRow extends ListRow {
  occurred_at_source: 'body' | 'received' | 'user';
  balance_after_pesewas: number | null;
  note_source: 'sms' | 'user' | null;
  reverses_txn_id: number | null;
  is_reversed: number;
}

/** Null when no live transaction has this id (never existed, or retracted). */
export async function transactionDetail(
  db: Db,
  id: number,
  today: Date,
): Promise<TransactionDetail | null> {
  const r = await db.get<DetailRow>(
    `SELECT ${ROW_COLUMNS}, l.occurred_at_source, l.balance_after_pesewas, l.note_source,
            l.reverses_txn_id, l.is_reversed
     FROM transaction_list l JOIN categories c ON c.id = l.category_id
     WHERE l.id = ?`,
    [id],
  );
  if (r === null) return null;
  const { row } = mapRow(r);
  const approximate = r.occurred_at_source === 'received';
  return {
    ...row,
    occurredAtLabel: occurredAtLabel(r.occurred_at, approximate, today),
    timeApproximate: approximate,
    kindLabel: r.origin === 'manual' ? 'Added by you.' : kindLabel(r.kind),
    balanceAfter: r.balance_after_pesewas === null ? null : pesewas(r.balance_after_pesewas),
    noteSource: r.note_source,
    originalMessage: null,
    reversed: r.is_reversed === 1,
    reversesId: r.reverses_txn_id === null ? null : String(r.reverses_txn_id),
  };
}
