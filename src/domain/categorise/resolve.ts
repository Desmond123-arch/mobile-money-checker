import { createMatcher, type Matcher } from './match';
import { cleanReference, tokenise } from './reference';
import { COUNTERPARTY_HINTS, COUNTERPARTY_RULES } from './seed';
import type { CategoriserConfig, Resolved, TxnFacts } from './types';

type Side = 'cash' | 'out' | 'in' | 'credit';

const SIDE: Record<TxnFacts['kind'], Side> = {
  payment_out: 'out',
  transfer_out: 'out',
  cash_out: 'cash',
  payment_in: 'in',
  cash_in: 'in',
  interest: 'in',
  refund: 'credit',
  reversal: 'credit',
};

const PROTECTED = ['family', 'friends', 'income', 'cash', 'misc'] as const;

interface Compiled {
  idOf: (systemKey: string) => number | undefined;
  names: Matcher<'family' | 'friends'>;
  keywords: Matcher<number>;
  config: CategoriserConfig;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function compile(config: CategoriserConfig): Compiled {
  const byKey = new Map<string, number>();
  for (const c of config.categories) if (c.systemKey) byKey.set(c.systemKey, c.id);
  for (const key of PROTECTED) {
    if (!byKey.has(key)) throw new Error(`categoriser config lacks the ${key} category`);
  }
  const rank = new Map(
    [...config.categories]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((c, i) => [c.id, i]),
  );
  return {
    idOf: (key) => byKey.get(key),
    names: createMatcher(
      config.names.map((n) => ({
        value: n.value,
        rank: n.kind === 'family' ? 0 : 1,
        exactOnly: false,
        tag: n.kind === 'family' ? ('family' as const) : ('friends' as const),
      })),
    ),
    keywords: createMatcher(
      config.keywords.flatMap((k) => {
        const r = rank.get(k.categoryId);
        return r === undefined
          ? []
          : [{ value: k.value, rank: r, exactOnly: k.isAlias, tag: k.categoryId }];
      }),
    ),
    config,
  };
}

const cache = new WeakMap<CategoriserConfig, Compiled>();
const compiled = (config: CategoriserConfig): Compiled => {
  let c = cache.get(config);
  if (!c) {
    c = compile(config);
    cache.set(config, c);
  }
  return c;
};

function ruleMatches(rule: CategoriserConfig['rules'][number], f: TxnFacts): boolean {
  switch (rule.matchField) {
    case 'number':
      return f.counterpartyNumber !== null && f.counterpartyNumber === rule.matchValue;
    case 'merchant_code':
      return f.merchantCode !== null && f.merchantCode === rule.matchValue;
    case 'name':
      return f.counterpartyName !== null && norm(f.counterpartyName) === norm(rule.matchValue);
  }
}

function counterpartyCategory(c: Compiled, name: string | null): number | undefined {
  if (name === null) return undefined;
  const lower = norm(name);
  for (const rule of COUNTERPARTY_RULES) {
    if (rule.contains.some((s) => lower.includes(s))) return c.idOf(rule.systemKey);
  }
  const padded = ` ${tokenise(lower).join(' ')} `;
  for (const hint of COUNTERPARTY_HINTS) {
    if (hint.words.some((w) => padded.includes(` ${w} `))) {
      const id = c.idOf(hint.systemKey);
      if (id !== undefined) return id;
    }
  }
  return undefined;
}

/**
 * docs/categorisation.md, rules 2 to 6. The user's manual tag is rule 1 and lives in
 * transaction_annotations, so the read view applies it and this function never sees it.
 * Incoming money and cash-outs skip the reference and the built-in rules.
 */
export function resolveCategory(f: TxnFacts, config: CategoriserConfig): Resolved {
  const c = compiled(config);
  const side = SIDE[f.kind];
  const dflt = (key: string): Resolved => ({ categoryId: c.idOf(key)!, source: 'default' });
  if (side === 'credit') return dflt('misc');

  const appliesTo = side === 'in' ? 'income' : 'spend';
  const rule = config.rules.find((r) => r.appliesTo === appliesTo && ruleMatches(r, f));
  if (rule) return { categoryId: rule.categoryId, source: 'rule' };

  if (side === 'cash') return dflt('cash');
  if (side === 'in') return dflt('income');

  const reference = cleanReference(f.reference);
  if (reference !== null) {
    const tokens = tokenise(reference);
    const name = c.names.match(tokens);
    if (name) return { categoryId: c.idOf(name.tag)!, source: 'keyword' };
    const word = c.keywords.match(tokens);
    if (word) return { categoryId: word.tag, source: 'keyword' };
  }

  const builtIn = counterpartyCategory(c, f.counterpartyName);
  if (builtIn !== undefined) return { categoryId: builtIn, source: 'default' };
  return dflt('misc');
}
