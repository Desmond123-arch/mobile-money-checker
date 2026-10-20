import type { Pesewas } from '../money';
import type { MessageKind } from './types';

export interface ProjectedTxn {
  momoTxnId: string;
  kind: MessageKind;
  amount: Pesewas;
  counterpartyName: string | null;
  /** Epoch milliseconds, UTC. */
  occurredAt: number;
}

export interface Link {
  reversalTxnId: string;
  originalTxnId: string;
  /** More than one earlier payment qualified; the closest was linked. */
  ambiguous: boolean;
}

export const REVERSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const CREDITS: ReadonlySet<MessageKind> = new Set(['reversal', 'refund']);
const SPEND: ReadonlySet<MessageKind> = new Set(['payment_out', 'cash_out', 'transfer_out']);

/**
 * "MTN BUNDLE" and "MTNBUNDLE", "Other Networks (one4all.sp)" and "Other Networks" are the same
 * counterparty. Casefold, drop a trailing "(…)" or ". (…)" suffix, keep letters only.
 */
export function normalizeName(name: string | null): string {
  return (name ?? '')
    .replace(/\s*\.?\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');
}

function sameCounterparty(a: string, b: string): boolean {
  return a !== '' && b !== '' && (a.startsWith(b) || b.startsWith(a));
}

/**
 * The reversal message carries its own transaction id, so a credit is matched to the closest earlier
 * spend row with the same amount and counterparty inside 30 days. `existing` holds links already made
 * (including the user's); those credits are skipped and those originals are not offered again.
 * Returns only the new links.
 */
export function linkReversals(
  txns: readonly ProjectedTxn[],
  existing: readonly Link[] = [],
): Link[] {
  const linkedCredits = new Set(existing.map((link) => link.reversalTxnId));
  const taken = new Set(existing.map((link) => link.originalTxnId));
  const names = new Map(txns.map((txn) => [txn.momoTxnId, normalizeName(txn.counterpartyName)]));

  const credits = txns
    .filter((txn) => CREDITS.has(txn.kind) && !linkedCredits.has(txn.momoTxnId))
    .sort((a, b) => a.occurredAt - b.occurredAt || a.momoTxnId.localeCompare(b.momoTxnId));

  const links: Link[] = [];
  for (const credit of credits) {
    const creditName = names.get(credit.momoTxnId) ?? '';
    const candidates = txns
      .filter(
        (txn) =>
          SPEND.has(txn.kind) &&
          !taken.has(txn.momoTxnId) &&
          txn.amount === credit.amount &&
          txn.occurredAt <= credit.occurredAt &&
          credit.occurredAt - txn.occurredAt <= REVERSAL_WINDOW_MS &&
          sameCounterparty(names.get(txn.momoTxnId) ?? '', creditName),
      )
      .sort((a, b) => b.occurredAt - a.occurredAt || a.momoTxnId.localeCompare(b.momoTxnId));

    const [closest] = candidates;
    if (closest === undefined) continue;
    taken.add(closest.momoTxnId);
    links.push({
      reversalTxnId: credit.momoTxnId,
      originalTxnId: closest.momoTxnId,
      ambiguous: candidates.length > 1,
    });
  }
  return links;
}
