import type { Pesewas } from '../money';

export type Direction = 'in' | 'out';

export interface TransactionRow {
  id: string;
  counterparty: string;
  categoryId: string | null;
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
