import type { Db } from '../db';
import type { TimeRange } from '@/domain/calendar/month';
import { amountLeft } from '@/domain/cash/allocation';
import { fallbackCounterparty } from '@/domain/transaction/label';

import { inRange, UI_CATEGORY_ID_SQL } from './sql';

export interface CashAllocation {
  id: number;
  /** UI category id. */
  categoryId: string;
  amount: number;
  note: string | null;
  /** Epoch ms of the day the cash was spent. */
  spentOn: number;
}

/** "Where the cash went" for one cash-out. */
export interface CashOutBreakdown {
  id: number;
  amount: number;
  occurredAt: number;
  counterparty: string;
  /** Newest spending day first. */
  allocations: CashAllocation[];
  allocated: number;
  left: number;
}

const LIVE_CASH_OUT = `t.origin = 'sms' AND t.kind = 'cash_out' AND t.flow = 'spend' AND t.retracted_at IS NULL`;

/** Null when `id` is not a live cash-out. */
export async function cashOutBreakdown(db: Db, id: number): Promise<CashOutBreakdown | null> {
  const t = await db.get<{
    amount_pesewas: number;
    occurred_at: number;
    counterparty_name: string | null;
    merchant_code: string | null;
  }>(
    `SELECT t.amount_pesewas, t.occurred_at, t.counterparty_name, t.merchant_code
     FROM transactions t WHERE t.id = ? AND ${LIVE_CASH_OUT}`,
    [id],
  );
  if (t === null) return null;
  const rows = await db.all<{
    id: number;
    category_id: string;
    amount_pesewas: number;
    note: string | null;
    spent_on: number;
  }>(
    `SELECT a.id, ${UI_CATEGORY_ID_SQL} AS category_id, a.amount_pesewas, a.note, a.spent_on
     FROM cash_allocations a JOIN categories c ON c.id = a.category_id
     WHERE a.cash_out_txn_id = ? ORDER BY a.spent_on DESC, a.id DESC`,
    [id],
  );
  const allocated = rows.reduce((sum, r) => sum + r.amount_pesewas, 0);
  return {
    id,
    amount: t.amount_pesewas,
    occurredAt: t.occurred_at,
    counterparty:
      t.counterparty_name ??
      (t.merchant_code === null ? fallbackCounterparty('cash_out') : `Merchant ${t.merchant_code}`),
    allocations: rows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      amount: r.amount_pesewas,
      note: r.note,
      spentOn: r.spent_on,
    })),
    allocated,
    left: amountLeft(t.amount_pesewas, allocated),
  };
}

export interface CashOutLeft {
  id: number;
  allocated: number;
  left: number;
}

/** Every live cash-out in the range with how much of it is broken down, for the Transactions rows. */
export async function cashOutLefts(db: Db, range: TimeRange): Promise<CashOutLeft[]> {
  const time = inRange('t.occurred_at', range);
  const rows = await db.all<{ id: number; amount_pesewas: number; allocated: number }>(
    `SELECT t.id, t.amount_pesewas,
            COALESCE((SELECT SUM(a.amount_pesewas) FROM cash_allocations a
                      WHERE a.cash_out_txn_id = t.id), 0) AS allocated
     FROM transactions t WHERE ${LIVE_CASH_OUT} AND ${time.sql}`,
    time.params,
  );
  return rows.map((r) => ({
    id: r.id,
    allocated: r.allocated,
    left: amountLeft(r.amount_pesewas, r.allocated),
  }));
}

export const OPEN_CASH_OUT_WINDOW_MS = 30 * 86_400_000;

/**
 * The newest cash-out from the last 30 days that still has something left to break down, for the
 * hint on Add expense. Null when there is none.
 */
export async function openCashOut(
  db: Db,
  now: number,
): Promise<{ id: number; left: number } | null> {
  const rows = await db.all<{ id: number; amount_pesewas: number; allocated: number }>(
    `SELECT t.id, t.amount_pesewas,
            COALESCE((SELECT SUM(a.amount_pesewas) FROM cash_allocations a
                      WHERE a.cash_out_txn_id = t.id), 0) AS allocated
     FROM transactions t
     WHERE ${LIVE_CASH_OUT} AND t.occurred_at > ? AND t.occurred_at <= ?
     ORDER BY t.occurred_at DESC, t.id DESC`,
    [now - OPEN_CASH_OUT_WINDOW_MS, now],
  );
  for (const r of rows) {
    const left = amountLeft(r.amount_pesewas, r.allocated);
    if (left > 0) return { id: r.id, left };
  }
  return null;
}
