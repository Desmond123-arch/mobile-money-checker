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
  kindLabel: string;
  balanceAfter: Pesewas;
  noteSource: 'sms' | 'user';
  originalMessage: string;
}
