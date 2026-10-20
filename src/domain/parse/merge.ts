import type { Pesewas } from '../money';
import type { OccurredAt } from '../time';
import type { MessageKind, ParsedFragment } from './types';

export interface MergedTxn {
  momoTxnId: string;
  kind: MessageKind;
  direction: 'in' | 'out';
  amount: Pesewas;
  fee: Pesewas | null;
  tax: Pesewas | null;
  balanceAfter: Pesewas | null;
  counterpartyName: string | null;
  merchantCode: string | null;
  counterpartyNumber: string | null;
  reference: string | null;
  occurredAt: OccurredAt;
  /** Two messages of one id disagree on amount or kind. The first (by receivedAt, androidId) wins. */
  hasConflict: boolean;
}

function byArrival(a: ParsedFragment, b: ParsedFragment): number {
  return (
    a.receivedAt - b.receivedAt ||
    a.androidId.localeCompare(b.androidId) ||
    a.template.name.localeCompare(b.template.name)
  );
}

function firstNonNull<T>(values: (T | null)[]): T | null {
  return values.find((value): value is T => value !== null) ?? null;
}

const hasDigit = (text: string) => /\d/.test(text);
const hasWord = (text: string) => /[\p{L}\p{N}]/u.test(text);

function pickName(names: string[]): string | null {
  return names.find((name) => !hasDigit(name)) ?? names[0] ?? null;
}

function pickReference(references: string[]): string | null {
  return references.find(hasWord) ?? references[0] ?? null;
}

function pickOccurredAt(times: OccurredAt[]): OccurredAt {
  const body = times.filter((time) => time.source === 'body');
  const pool = body.length > 0 ? body : times;
  return pool.reduce((earliest, time) => (time.at < earliest.at ? time : earliest));
}

/**
 * Fold every fragment of one transaction id into one row. Commutative: the fragments are put in a fixed
 * order first, and each field follows its own precedence rather than "fill empty", so the order
 * messages arrive in never changes the result.
 */
export function mergeAll(fragments: readonly ParsedFragment[]): MergedTxn {
  const sorted = [...fragments].sort(byArrival);
  const [first] = sorted;
  if (first === undefined) throw new RangeError('mergeAll needs at least one fragment');

  const names = sorted.flatMap((f) => (f.counterpartyName === null ? [] : [f.counterpartyName]));
  const references = sorted.flatMap((f) => (f.reference === null ? [] : [f.reference]));

  return {
    momoTxnId: first.momoTxnId,
    kind: first.kind,
    direction: first.direction,
    amount: first.amount,
    fee: firstNonNull(sorted.map((f) => f.fee)),
    tax: firstNonNull(sorted.map((f) => f.tax)),
    balanceAfter: firstNonNull(sorted.map((f) => f.balanceAfter)),
    counterpartyName: pickName(names),
    merchantCode: firstNonNull(sorted.map((f) => f.merchantCode)),
    counterpartyNumber: firstNonNull(sorted.map((f) => f.counterpartyNumber)),
    reference: pickReference(references),
    occurredAt: pickOccurredAt(sorted.map((f) => f.occurredAt)),
    hasConflict: sorted.some((f) => f.amount !== first.amount || f.kind !== first.kind),
  };
}
