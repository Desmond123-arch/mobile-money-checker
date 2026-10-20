import type { Pesewas } from '../money';

export type Direction = 'in' | 'out';

/** What a list row needs. The ledger will project this from stored transactions. */
export interface TransactionRow {
  id: string;
  counterparty: string;
  categoryId: string | null;
  /** The reference or note, if the payer wrote one. Null means the row asks for a note. */
  note: string | null;
  direction: Direction;
  amount: Pesewas;
}

export interface TransactionDetail extends TransactionRow {
  occurredAtLabel: string;
  kindLabel: string;
  fee: Pesewas;
  tax: Pesewas;
  balanceAfter: Pesewas;
  noteSource: 'sms' | 'user';
  originalMessage: string;
}
