import type { Pesewas } from '../money';
import type { OccurredAt } from '../time';

/** Bump whenever a template changes; a newer value triggers a re-parse at next app start. */
export const PARSER_VERSION = 1;

export interface RawSms {
  androidId: string;
  sender: string;
  body: string;
  receivedAt: number;
}

export type MessageKind =
  | 'payment_out'
  | 'cash_out'
  | 'transfer_out'
  | 'payment_in'
  | 'cash_in'
  | 'interest'
  | 'refund'
  | 'reversal';

export interface ParsedFragment {
  momoTxnId: string;
  kind: MessageKind;
  direction: 'in' | 'out';
  amount: Pesewas;
  /** null = this message does not say; 0 = it says zero. */
  fee: Pesewas | null;
  tax: Pesewas | null;
  balanceAfter: Pesewas | null;
  counterpartyName: string | null;
  /** "Merchant 033097" goes here, never in counterpartyName. */
  merchantCode: string | null;
  counterpartyNumber: string | null;
  /** Raw and uncleaned; cleaning happens in resolveCategory. */
  reference: string | null;
  occurredAt: OccurredAt;
  receivedAt: number;
  androidId: string;
  template: { name: string; version: number };
}

export type IgnoreReason = 'otp' | 'promo' | 'no_txn_id' | 'withheld' | 'pin_notice' | 'failed';

export type ParseResult =
  | { status: 'parsed'; fragment: ParsedFragment }
  | { status: 'ignored'; reason: IgnoreReason }
  | { status: 'unparsed' };

export interface Template {
  name: string;
  version: number;
  test(body: string): boolean;
  parse(body: string, sms: RawSms): ParsedFragment | null;
}
