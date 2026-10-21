import { SEED_KEYWORDS } from '../seed';
import { resolveCategory } from '../resolve';
import type { CategoriserConfig, NameEntry, RecipientRule, TxnFacts } from '../types';

const KEYS = [
  'family',
  'friends',
  'income',
  'cash',
  'misc',
  ...SEED_KEYWORDS.map((s) => s.systemKey),
];
const ID = Object.fromEntries(KEYS.map((k, i) => [k, i + 1])) as Record<string, number>;

const build = (names: NameEntry[] = [], rules: RecipientRule[] = []): CategoriserConfig => ({
  categories: KEYS.map((k, i) => ({ id: ID[k]!, systemKey: k, sortOrder: (i + 1) * 10 })),
  keywords: SEED_KEYWORDS.flatMap((s) => [
    ...s.words.map((value) => ({ categoryId: ID[s.systemKey]!, value, isAlias: false })),
    ...(s.aliases ?? []).map((value) => ({ categoryId: ID[s.systemKey]!, value, isAlias: true })),
  ]),
  names,
  rules,
});

const out = (reference: string | null, over: Partial<TxnFacts> = {}): TxnFacts => ({
  kind: 'payment_out',
  counterpartyName: null,
  counterpartyNumber: null,
  merchantCode: null,
  reference,
  ...over,
});

const config = build();
const key = (f: TxnFacts, cfg = config) => {
  const r = resolveCategory(f, cfg);
  return [Object.keys(ID).find((k) => ID[k] === r.categoryId), r.source];
};

describe('keywords', () => {
  it.each([
    ['bread', 'food'],
    ['Bread.', 'food'],
    ['transport', 'transport'],
    ['top up', 'airtime'],
    ['topup', 'airtime'],
  ])('exact: %s -> %s', (ref, cat) => {
    expect(key(out(ref))).toEqual([cat, 'keyword']);
  });

  it('matches multi-word phrases with or without the space', () => {
    expect(key(out('ground nut'))).toEqual(['food', 'keyword']);
    expect(key(out('groundnut'))).toEqual(['food', 'keyword']);
    expect(key(out('meat pie'))).toEqual(['food', 'keyword']);
    expect(key(out('tea+bread'))).toEqual(['food', 'keyword']);
  });

  it('matches a reference that names several things by the first category in priority order', () => {
    expect(key(out('bread egg'))).toEqual(['food', 'keyword']);
    expect(key(out('taxi bread'))).toEqual(['food', 'keyword']);
    expect(key(out('doctor taxi'))).toEqual(['transport', 'keyword']);
  });

  it('tolerates one typo and a swapped pair', () => {
    expect(key(out('noodkes'))).toEqual(['food', 'keyword']);
    expect(key(out('launch'))).toEqual(['food', 'keyword']);
    expect(key(out('nodoles'))).toEqual(['food', 'keyword']);
    expect(key(out('jolof'))).toEqual(['food', 'keyword']);
  });

  it('uses aliases for misspellings fuzzy matching misses', () => {
    expect(key(out('wayer'))).toEqual(['food', 'keyword']);
    expect(key(out('waskye'))).toEqual(['food', 'keyword']);
    expect(key(out('shitor'))).toEqual(['food', 'keyword']);
  });

  it('keeps the three wrong matches of plain distance 1 out', () => {
    expect(key(out('paste'))).toEqual(['misc', 'default']);
    expect(key(out('batter'))).toEqual(['misc', 'default']);
    expect(key(out('charges'))).toEqual(['misc', 'default']);
  });

  it('keeps short tokens exact-only', () => {
    expect(key(out('car'))).toEqual(['misc', 'default']);
    expect(key(out('pig'))).toEqual(['misc', 'default']);
  });

  it('prefers the nearer fuzzy match, then the higher priority', () => {
    const near: CategoriserConfig = {
      ...build(),
      keywords: [
        { categoryId: ID.food!, value: 'abcdxfxhi', isAlias: false },
        { categoryId: ID.shopping!, value: 'abcdefxhi', isAlias: false },
      ],
    };
    expect(key(out('abcdefghi'), near)).toEqual(['shopping', 'keyword']);
    const tie: CategoriserConfig = {
      ...build(),
      keywords: [
        { categoryId: ID.shopping!, value: 'wollets', isAlias: false },
        { categoryId: ID.food!, value: 'wallexs', isAlias: false },
      ],
    };
    expect(key(out('wallets'), tie)).toEqual(['food', 'keyword']);
  });

  it('ignores a keyword whose category is not in the config', () => {
    const cfg: CategoriserConfig = {
      ...build(),
      keywords: [{ categoryId: 9999, value: 'bread', isAlias: false }],
    };
    expect(key(out('bread'), cfg)).toEqual(['misc', 'default']);
  });

  it('resolves a duplicated user keyword to the earlier category', () => {
    const cfg: CategoriserConfig = {
      ...build(),
      keywords: [
        { categoryId: ID.shopping!, value: 'market', isAlias: false },
        { categoryId: ID.food!, value: 'market', isAlias: false },
      ],
    };
    expect(key(out('market'), cfg)).toEqual(['food', 'keyword']);
  });
});

describe('references', () => {
  it.each([
    '',
    '-',
    '.',
    'momo',
    '1',
    'no',
    'merchantpay',
    'my number',
    'stuff',
    'direct',
    'debit',
  ])('treats %j as empty', (ref) => {
    expect(key(out(ref))).toEqual(['misc', 'default']);
  });

  it('uses only the last part of name,number,note', () => {
    expect(key(out('Kofi Bread,233244000000,rice'))).toEqual(['food', 'keyword']);
    expect(key(out('rice,233244000000,-'))).toEqual(['misc', 'default']);
  });

  it('does not treat credit as junk', () => {
    expect(key(out('credit'))).toEqual(['airtime', 'keyword']);
  });

  it('handles a null reference', () => {
    expect(key(out(null))).toEqual(['misc', 'default']);
  });
});

describe('names', () => {
  const names = (...n: [NameEntry['kind'], string][]) =>
    build(n.map(([kind, value]) => ({ kind, value })));

  it('start empty: a name means nothing until it is listed', () => {
    expect(key(out('maa'))).toEqual(['misc', 'default']);
  });

  it('maps family and friends names, and a name beats a keyword', () => {
    const cfg = names(['family', 'maa'], ['friend', 'andy']);
    expect(key(out('maa'), cfg)).toEqual(['family', 'keyword']);
    expect(key(out('andy bread'), cfg)).toEqual(['friends', 'keyword']);
  });

  it('matches names with the same typo tolerance', () => {
    const cfg = names(['friend', 'akosua']);
    expect(key(out('akosue'), cfg)).toEqual(['misc', 'default']);
    expect(key(out('akousa'), cfg)).toEqual(['friends', 'keyword']);
  });

  it('prefers family when a token fits both lists equally', () => {
    const cfg = names(['friend', 'kwame'], ['family', 'kwame']);
    expect(key(out('kwame'), cfg)).toEqual(['family', 'keyword']);
  });
});

describe('recipient rules', () => {
  const rule = (over: Partial<RecipientRule>): RecipientRule => ({
    matchField: 'number',
    matchValue: '233244000000',
    appliesTo: 'spend',
    categoryId: ID.transport!,
    ...over,
  });

  it('beat the reference', () => {
    const cfg = build([], [rule({})]);
    expect(key(out('bread', { counterpartyNumber: '233244000000' }), cfg)).toEqual([
      'transport',
      'rule',
    ]);
  });

  it('match by merchant code and by name, ignoring case and spacing', () => {
    const cfg = build(
      [],
      [
        rule({ matchField: 'merchant_code', matchValue: '033097' }),
        rule({ matchField: 'name', matchValue: 'Kofi  Mensah', categoryId: ID.family! }),
      ],
    );
    expect(key(out(null, { merchantCode: '033097' }), cfg)).toEqual(['transport', 'rule']);
    expect(key(out(null, { counterpartyName: 'KOFI MENSAH' }), cfg)).toEqual(['family', 'rule']);
    expect(key(out(null, { counterpartyName: null }), cfg)).toEqual(['misc', 'default']);
    expect(key(out(null, { counterpartyNumber: null, merchantCode: null }), cfg)).toEqual([
      'misc',
      'default',
    ]);
  });

  it('are scoped to the flow: a spend rule does not tag incoming money', () => {
    const cfg = build([], [rule({})]);
    expect(key(out(null, { kind: 'payment_in', counterpartyNumber: '233244000000' }), cfg)).toEqual(
      ['income', 'default'],
    );
    const incoming = build([], [rule({ appliesTo: 'income', categoryId: ID.giving! })]);
    expect(
      key(out(null, { kind: 'payment_in', counterpartyNumber: '233244000000' }), incoming),
    ).toEqual(['giving', 'rule']);
  });
});

describe('type defaults and built-in counterparty rules', () => {
  it('keeps cash-out in Cash, even for a food-looking agent', () => {
    expect(key(out(null, { kind: 'cash_out', counterpartyName: 'BALOMI FOOD VENTURES' }))).toEqual([
      'cash',
      'default',
    ]);
  });

  it('sends incoming money to Income and skips references and counterparty rules', () => {
    expect(key(out('rice', { kind: 'payment_in', counterpartyName: 'MTN AIRTIME' }))).toEqual([
      'income',
      'default',
    ]);
    expect(key(out(null, { kind: 'cash_in' }))).toEqual(['income', 'default']);
    expect(key(out(null, { kind: 'interest' }))).toEqual(['income', 'default']);
  });

  it('sends refunds and reversals to Misc', () => {
    expect(key(out(null, { kind: 'reversal' }))).toEqual(['misc', 'default']);
  });

  it.each([
    ['MTN AIRTIME', 'airtime'],
    ['MTNBUNDLE', 'airtime'],
    ['Just4u', 'airtime'],
    ['Other Networks (one4all.sp)', 'airtime'],
    ['TELECEL PUSH', 'airtime'],
    ['Utility Bills', 'rent'],
  ])('applies the built-in rule for %s', (name, cat) => {
    expect(key(out(null, { counterpartyName: name }))).toEqual([cat, 'default']);
  });

  it.each(['PAYSTACK', 'MojoPay Ltd', 'cellulant'])('leaves %s in Misc', (name) => {
    expect(key(out(null, { counterpartyName: name }))).toEqual(['misc', 'default']);
  });

  it('lets the reference beat a built-in rule', () => {
    expect(key(out('taxi', { counterpartyName: 'MTN AIRTIME' }))).toEqual(['transport', 'keyword']);
  });

  it('uses word hints for business names, and ignores generic business words', () => {
    expect(key(out(null, { counterpartyName: 'Aunty Ama Chop Bar' }))).toEqual(['food', 'default']);
    expect(key(out(null, { counterpartyName: 'City Pharmacy' }))).toEqual(['health', 'default']);
    expect(key(out(null, { counterpartyName: 'Goil Filling Station' }))).toEqual([
      'transport',
      'default',
    ]);
    expect(key(out(null, { counterpartyName: 'Balomi Ventures Limited' }))).toEqual([
      'misc',
      'default',
    ]);
    expect(key(out(null, { counterpartyName: 'Jointly' }))).toEqual(['misc', 'default']);
  });

  it('skips a built-in rule or hint whose category was deleted', () => {
    const base = build();
    const cfg: CategoriserConfig = {
      ...base,
      categories: base.categories.filter((c) => c.systemKey !== 'health'),
    };
    expect(key(out(null, { counterpartyName: 'City Pharmacy' }), cfg)).toEqual(['misc', 'default']);
  });

  it('refuses a config without the protected categories', () => {
    expect(() =>
      resolveCategory(out('x'), { categories: [], keywords: [], names: [], rules: [] }),
    ).toThrow(/family/);
  });
});
