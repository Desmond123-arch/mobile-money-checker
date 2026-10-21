import type { Db } from '@/data/db';
import { allocationProblem, amountLeft } from '@/domain/cash/allocation';

import { categoryRowId } from './categoryRef';
import { ledgerQueue } from './writeQueue';

export interface AllocationInput {
  /** UI category id. Income cannot be picked: an allocation redistributes spend. */
  categoryId: string;
  amount: number;
  /** Trimmed; empty means none. */
  note?: string;
  /** Epoch ms of the day the cash was spent. Informational: totals follow the cash-out's date. */
  spentOn: number;
}

/** A refused entry carries the words the form shows. */
export type AllocationResult = { ok: true; id: number } | { ok: false; message: string };

interface CashOut {
  amount_pesewas: number;
  occurred_at: number;
}

async function liveCashOut(tx: Db, id: number): Promise<CashOut> {
  const row = await tx.get<CashOut>(
    `SELECT amount_pesewas, occurred_at FROM transactions
     WHERE id = ? AND origin = 'sms' AND kind = 'cash_out' AND flow = 'spend'
       AND retracted_at IS NULL`,
    [id],
  );
  if (row === null) throw new Error(`no cash-out ${id}`);
  return row;
}

/** Checks one entry against the cash-out. `ownId` is the entry being edited, if any. */
async function check(
  tx: Db,
  cashOutId: number,
  input: AllocationInput,
  now: number,
  ownId: number | null,
): Promise<string | null> {
  const cashOut = await liveCashOut(tx, cashOutId);
  const others = await tx.get<{ s: number | null }>(
    `SELECT SUM(amount_pesewas) AS s FROM cash_allocations
     WHERE cash_out_txn_id = ? AND id IS NOT ?`,
    [cashOutId, ownId],
  );
  const row = await categoryRowId(tx, input.categoryId);
  const isIncome =
    row !== null &&
    (
      await tx.get<{ system_key: string | null }>(
        'SELECT system_key FROM categories WHERE id = ?',
        [row],
      )
    )?.system_key === 'income';
  return allocationProblem(
    {
      categoryId: row === null || isIncome ? null : input.categoryId,
      amount: input.amount,
      spentOn: input.spentOn,
    },
    {
      room: amountLeft(cashOut.amount_pesewas, others?.s ?? 0),
      cashOutAt: cashOut.occurred_at,
      now,
    },
  );
}

const cleanNote = (note: string | undefined): string | null => {
  const text = note?.trim() ?? '';
  return text === '' ? null : text;
};

/** Records that `input.amount` of a cash-out went to a category. One exclusive transaction. */
export function addAllocation(
  db: Db,
  cashOutId: number,
  input: AllocationInput,
  now: number = Date.now(),
): Promise<AllocationResult> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<AllocationResult> => {
      const message = await check(tx, cashOutId, input, now, null);
      if (message !== null) return { ok: false, message };
      const { lastInsertRowId } = await tx.run(
        `INSERT INTO cash_allocations (cash_out_txn_id, category_id, amount_pesewas, note, spent_on,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cashOutId,
          (await categoryRowId(tx, input.categoryId))!,
          input.amount,
          cleanNote(input.note),
          input.spentOn,
          now,
          now,
        ],
      );
      return { ok: true, id: lastInsertRowId };
    }),
  );
}

/** Replaces every field of an entry. What is left is checked with the entry's old amount given back. */
export function updateAllocation(
  db: Db,
  allocationId: number,
  input: AllocationInput,
  now: number = Date.now(),
): Promise<AllocationResult> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<AllocationResult> => {
      const own = await tx.get<{ cash_out_txn_id: number }>(
        'SELECT cash_out_txn_id FROM cash_allocations WHERE id = ?',
        [allocationId],
      );
      if (own === null) throw new Error(`no allocation ${allocationId}`);
      const message = await check(tx, own.cash_out_txn_id, input, now, allocationId);
      if (message !== null) return { ok: false, message };
      await tx.run(
        `UPDATE cash_allocations SET category_id = ?, amount_pesewas = ?, note = ?, spent_on = ?,
           updated_at = ? WHERE id = ?`,
        [
          (await categoryRowId(tx, input.categoryId))!,
          input.amount,
          cleanNote(input.note),
          input.spentOn,
          now,
          allocationId,
        ],
      );
      return { ok: true, id: allocationId };
    }),
  );
}

/** Gives the amount back to what is left. Deleting an entry that is already gone does nothing. */
export function deleteAllocation(db: Db, allocationId: number): Promise<void> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      await tx.run('DELETE FROM cash_allocations WHERE id = ?', [allocationId]);
    }),
  );
}
