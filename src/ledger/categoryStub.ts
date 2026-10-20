import type { MessageKind } from '@/domain/parse/types';

export type AutoCategory = { systemKey: 'cash' | 'income' | 'misc'; source: 'default' };

// Placeholder for the real categoriser (docs/categorisation.md). Ingest calls only this function,
// so the categoriser piece replaces this file and nothing else.
export function resolveCategoryStub(kind: MessageKind): AutoCategory {
  if (kind === 'cash_out') return { systemKey: 'cash', source: 'default' };
  if (kind === 'payment_in' || kind === 'cash_in' || kind === 'interest') {
    return { systemKey: 'income', source: 'default' };
  }
  return { systemKey: 'misc', source: 'default' };
}
