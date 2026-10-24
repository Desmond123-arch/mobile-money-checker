import type { Pesewas } from '../money';
import type { MessageKind } from './types';

export interface BalanceRow {
  kind: MessageKind;
  amount: Pesewas;
  fee: Pesewas | null;
  tax: Pesewas | null;
  balanceAfter: Pesewas | null;
}

export interface Reconciliation {
  /** Previous balance minus the amount alone equals this balance (fee and tax were zero or unreported). */
  amountOnly: number;
  /** Equal only once fee and tax are subtracted too. */
  withCharges: number;
  /** Neither; usually a message missing from the export between the two. */
  mismatch: number;
  total: number;
}

const OUTGOING: ReadonlySet<MessageKind> = new Set(['payment_out', 'cash_out', 'transfer_out']);

/**
 * `rows` are transactions in chronological order. Every outgoing row that has a balance is checked against
 * the balance of the row before it: before - (amount + fee + tax) = after. The first row has nothing to
 * compare with, and rows without a balance are skipped.
 */
export function reconcileBalances(rows: readonly BalanceRow[]): Reconciliation {
  const result = { amountOnly: 0, withCharges: 0, mismatch: 0, total: 0 };
  let previous: Pesewas | null = null;
  for (const row of rows) {
    if (row.balanceAfter === null) continue;
    if (previous !== null && OUTGOING.has(row.kind)) {
      const charges = (row.fee ?? 0) + (row.tax ?? 0);
      if (previous - row.amount === row.balanceAfter) result.amountOnly += 1;
      else if (previous - row.amount - charges === row.balanceAfter) result.withCharges += 1;
      else result.mismatch += 1;
      result.total += 1;
    }
    previous = row.balanceAfter;
  }
  return result;
}
