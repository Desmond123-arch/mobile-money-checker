import type { Pesewas } from '../money';

export type Direction = 'in' | 'out';

export interface TransactionRow {
  id: string;
  counterparty: string;
  categoryId: string | null;
  note: string | null;
  direction: Direction;
  amount: Pesewas;
  manual?: boolean;
}

export interface TransactionDetail extends TransactionRow {
  occurredAtLabel: string;
  /** True when the time is the SMS received time, not a time the message stated. */
  timeApproximate: boolean;
  kindLabel: string;
  /** Null for hand-added expenses, which have no balance to report. */
  balanceAfter: Pesewas | null;
  /** Null when there is no note at all. */
  noteSource: 'sms' | 'user' | null;
  /** Message text is never stored; null until it is read back from the phone's inbox. */
  originalMessage: string | null;
  /** A credit has since given this payment back, in full or part. */
  reversed: boolean;
  /** Set on a refund or reversal that is linked to its original payment. */
  reversesId: string | null;
}
