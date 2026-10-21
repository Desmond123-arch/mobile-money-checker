import type { Db } from '@/data/db';
import { getMeta } from '@/data/meta';
import { resolveCategory } from '@/domain/categorise/resolve';
import { isSelfTransfer } from '@/domain/categorise/self';
import { cleanReference } from '@/domain/categorise/reference';
import type { CategoriserConfig, TxnFacts } from '@/domain/categorise/types';

export interface Owner {
  number: string | null;
  name: string | null;
}

/** Everything categorising a batch needs, read once so a batch sees one consistent config. */
export interface CategoriserContext {
  config: CategoriserConfig;
  owner: Owner;
}

export interface Categorised {
  categoryId: number;
  source: 'rule' | 'keyword' | 'default';
  referenceClean: string | null;
  isSelfTransfer: boolean;
}

export async function loadCategoriserContext(tx: Db): Promise<CategoriserContext> {
  const [categories, keywords, names, rules, number, name] = await Promise.all([
    tx.all<{ id: number; system_key: string | null; sort_order: number }>(
      'SELECT id, system_key, sort_order FROM categories',
    ),
    tx.all<{ category_id: number; value: string; is_alias: number }>(
      'SELECT category_id, value, is_alias FROM keywords',
    ),
    tx.all<{ kind: 'family' | 'friend'; value: string }>('SELECT kind, value FROM name_lists'),
    tx.all<{
      match_field: 'number' | 'merchant_code' | 'name';
      match_value: string;
      applies_to: 'spend' | 'income';
      category_id: number;
    }>('SELECT match_field, match_value, applies_to, category_id FROM recipient_rules'),
    getMeta(tx, 'owner_number'),
    getMeta(tx, 'owner_name'),
  ]);
  return {
    config: {
      categories: categories.map((c) => ({
        id: c.id,
        systemKey: c.system_key,
        sortOrder: c.sort_order,
      })),
      keywords: keywords.map((k) => ({
        categoryId: k.category_id,
        value: k.value,
        isAlias: k.is_alias === 1,
      })),
      names,
      rules: rules.map((r) => ({
        matchField: r.match_field,
        matchValue: r.match_value,
        appliesTo: r.applies_to,
        categoryId: r.category_id,
      })),
    },
    owner: { number, name },
  };
}

/** The single seam between the ledger and the categoriser: ingest and recategorise both call only this. */
export function categorise(facts: TxnFacts, ctx: CategoriserContext): Categorised {
  const resolved = resolveCategory(facts, ctx.config);
  return {
    categoryId: resolved.categoryId,
    source: resolved.source,
    referenceClean: cleanReference(facts.reference),
    isSelfTransfer: isSelfTransfer(
      { name: facts.counterpartyName, number: facts.counterpartyNumber },
      ctx.owner,
    ),
  };
}
