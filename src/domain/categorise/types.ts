import type { MessageKind } from '../parse/types';

export interface CategoryRef {
  id: number;
  /** null for user-made categories. */
  systemKey: string | null;
  /** Display order, and the priority when two categories match a reference equally well. */
  sortOrder: number;
}

export interface KeywordEntry {
  categoryId: number;
  /** Lowercase, single-spaced. */
  value: string;
  /** Aliases are exact-only: they cover misspellings fuzzy matching would miss. */
  isAlias: boolean;
}

export interface NameEntry {
  kind: 'family' | 'friend';
  value: string;
}

export interface RecipientRule {
  matchField: 'number' | 'merchant_code' | 'name';
  matchValue: string;
  appliesTo: 'spend' | 'income';
  categoryId: number;
}

export interface CategoriserConfig {
  categories: readonly CategoryRef[];
  keywords: readonly KeywordEntry[];
  names: readonly NameEntry[];
  rules: readonly RecipientRule[];
}

export interface TxnFacts {
  kind: MessageKind;
  counterpartyName: string | null;
  counterpartyNumber: string | null;
  merchantCode: string | null;
  /** Raw, as stored in transactions.sms_reference. */
  reference: string | null;
}

export interface Resolved {
  categoryId: number;
  source: 'rule' | 'keyword' | 'default';
}
