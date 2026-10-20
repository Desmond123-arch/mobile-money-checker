import { parseAmount, type Pesewas } from '../money';
import { resolveOccurredAt } from '../time';
import type { MessageKind, ParsedFragment, RawSms, Template } from './types';

/** A plain amount token. Thousands commas only when followed by three digits, so "0.00,Tax" stops at "0.00". */
export const NUMBER = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`;
export const AMOUNT = String.raw`GH[SC]\s*(?<amount>${NUMBER})`;
export const BODY_TIME = String.raw`\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}`;

// "External Transaction Id" is a second, unrelated number that some shapes append; never the key.
const TXN_LABEL = /(?<!external\s)transaction\s+id/i;
const TXN_ID = /(?<!external\s)transaction\s+id\s*:?\s*(\d+)/i;

export function hasTxnLabel(body: string): boolean {
  return TXN_LABEL.test(body);
}

export function txnId(body: string): string | null {
  return TXN_ID.exec(body)?.[1] ?? null;
}

/**
 * The amount after a label such as "Fee charged". A dash means the message says zero ("Tax was GHS -").
 * An absent label is null: the message does not say.
 */
function labelled(body: string, label: string): Pesewas | null {
  const match = new RegExp(String.raw`${label}\s*:?\s*(?:GH[SC])?\s*(-|${NUMBER})`, 'i').exec(body);
  const value = match?.[1];
  if (value === undefined) return null;
  return value === '-' ? (0 as Pesewas) : parseAmount(value);
}

export const fee = (body: string) =>
  labelled(body, String.raw`(?:fee\s+(?:charged|was)|transaction\s+fee(?:\s+is)?)`);
export const tax = (body: string) => labelled(body, String.raw`tax\s+(?:charged|was)`);
export const balance = (body: string) =>
  labelled(body, String.raw`(?:current balance|your new balance(?:\s+is)?)`);

/** Trim, drop the sentence-final dot the template adds, and treat nothing as null. Junk like "-" stays for the categoriser. */
export function cleanText(text: string | undefined): string | null {
  const cleaned = (text ?? '').trim().replace(/\s*\.$/, '');
  return cleaned === '' ? null : cleaned;
}

const MERCHANT = /^merchant\s+(\d+)$/i;

export function splitCounterparty(name: string | undefined): {
  counterpartyName: string | null;
  merchantCode: string | null;
} {
  const cleaned = cleanText(name);
  const code = cleaned === null ? undefined : MERCHANT.exec(cleaned)?.[1];
  return code === undefined
    ? { counterpartyName: cleaned, merchantCode: null }
    : { counterpartyName: null, merchantCode: code };
}

/** References of the form "name ,233XXXXXXXXX,note" carry the counterparty's number in the middle part. */
export function numberInReference(reference: string | null): string | null {
  const parts = reference?.split(',');
  const middle = parts !== undefined && parts.length >= 3 ? parts[1]?.trim() : undefined;
  return middle !== undefined && /^\d{9,13}$/.test(middle) ? middle : null;
}

export interface Shape {
  name: string;
  version: number;
  kind: MessageKind;
  direction: 'in' | 'out';
  /** Anchored at the start of the body. Named groups: `amount`, and optionally `name` and `time`. */
  head: RegExp;
  /** Group 1 is the free-text reference, for shapes that carry one. */
  reference?: RegExp;
}

export function shapeTemplate(shape: Shape): Template {
  return {
    name: shape.name,
    version: shape.version,
    test: (body) => shape.head.test(body),
    parse: (body, sms) => build(shape, body, sms),
  };
}

function build(shape: Shape, body: string, sms: RawSms): ParsedFragment | null {
  const groups = shape.head.exec(body)?.groups;
  const momoTxnId = txnId(body);
  const amount = parseAmount(groups?.amount ?? '');
  if (groups === undefined || momoTxnId === null || amount === null) return null;

  const reference =
    shape.reference === undefined ? null : cleanText(shape.reference.exec(body)?.[1]);
  return {
    momoTxnId,
    kind: shape.kind,
    direction: shape.direction,
    amount,
    fee: fee(body),
    tax: tax(body),
    balanceAfter: balance(body),
    ...splitCounterparty(groups.name),
    counterpartyNumber: numberInReference(reference),
    reference,
    occurredAt: resolveOccurredAt(groups.time ?? null, sms.receivedAt),
    receivedAt: sms.receivedAt,
    androidId: sms.androidId,
    template: { name: shape.name, version: shape.version },
  };
}
