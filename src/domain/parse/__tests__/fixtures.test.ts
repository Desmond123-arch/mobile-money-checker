import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeAll } from '../merge';
import { parseSms } from '../parse';
import { TEMPLATES } from '../registry';
import type { ParsedFragment, ParseResult, RawSms } from '../types';

interface FixtureMessage {
  layout: string;
  synthetic: boolean;
  sms: RawSms;
  expected: ParseResult;
}

const ROOT = join(__dirname, '..', '..', '..', '..');
const DIR = join(ROOT, 'fixtures', 'sms');

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map(
    (name) =>
      JSON.parse(readFileSync(join(DIR, name), 'utf8')) as {
        shape: string;
        messages: FixtureMessage[];
      },
  );
const all = files.flatMap((file) =>
  file.messages.map((message) => ({ shape: file.shape, ...message })),
);

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('fixtures: one test per message', () => {
  it.each(all.map((m) => [`${m.shape} ${m.sms.androidId} (${m.layout})`, m] as const))(
    '%s',
    (_name, message) => {
      expect(parseSms(message.sms)).toEqual(message.expected);
    },
  );
});

describe('fixtures: coverage of the shapes', () => {
  it('has a file for every template and for failed payments, with at least 5 messages each', () => {
    const expected = [...TEMPLATES.map((template) => template.name), 'failed'].sort();
    expect(files.map((file) => file.shape).sort()).toEqual(expected);
    for (const file of files) expect(file.messages.length).toBeGreaterThanOrEqual(5);
  });

  it('includes the layout variants the parser must handle', () => {
    const bodies = (shape: string) =>
      files.find((file) => file.shape === shape)?.messages.map((m) => m.sms.body) ?? [];
    const made = bodies('payment_made');
    expect(made.some((body) => body.includes('Tax charged:'))).toBe(true);
    expect(made.some((body) => body.includes('TAX charged: GHS'))).toBe(true);
    const promo = all.map((m) => m.sms.body.includes('Download the MoMo App'));
    expect(promo).toContain(true);
    expect(promo).toContain(false);
    expect(bodies('reversal').some((body) => body.includes('transaction ID:'))).toBe(true);
    expect(bodies('merchant_paid').every((body) => /at \d{12}\./.test(body))).toBe(true);
    for (const message of all.filter((m) => m.shape === 'failed')) {
      expect(message.expected).toEqual({ status: 'ignored', reason: 'failed' });
    }
  });
});

describe('fixtures: merge is order independent', () => {
  const groups = new Map<string, ParsedFragment[]>();
  for (const message of all) {
    if (message.expected.status !== 'parsed') continue;
    const fragment = message.expected.fragment;
    groups.set(fragment.momoTxnId, [...(groups.get(fragment.momoTxnId) ?? []), fragment]);
  }
  const pairs = [...groups.entries()].filter(([, group]) => group.length > 1);

  it('has same-id pairs that cross shapes', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    expect(
      pairs.filter(([, g]) => new Set(g.map((f) => f.template.name)).size > 1).length,
    ).toBeGreaterThan(5);
  });

  it.each(pairs)('both orders of %s give the same row and no conflict', (_id, group) => {
    const forwards = mergeAll(group);
    expect(mergeAll([...group].reverse())).toEqual(forwards);
    expect(forwards.hasConflict).toBe(false);
  });

  it('merges a named and a merchant-coded message into one name plus one code', () => {
    const merchant = pairs.find(([, g]) => g.some((f) => f.merchantCode !== null));
    expect(merchant).toBeDefined();
    const merged = mergeAll(merchant?.[1] ?? []);
    expect(merged.merchantCode).not.toBeNull();
    expect(merged.counterpartyName).not.toMatch(/^Merchant/);
  });
});

describe('fixtures: no personal data', () => {
  const texts = files.flatMap((file) => strings(file.messages.map((m) => m.sms.body)));
  const PHONE_LIKE = /(?<!\d)(?:\+?233|0)\d{8,11}(?!\d)/g;
  const DIGIT_RUN = /\d{9,}/g;

  it('only has phone-like numbers inside the documented fake range (NSN 20000xxxx)', () => {
    const found = texts.flatMap((text) => text.match(PHONE_LIKE) ?? []);
    expect(found.length).toBeGreaterThan(0);
    for (const number of found) expect(number).toMatch(/^(?:\+?233|0)20000\d*$/);
  });

  it('only has long digit runs that are fake ids, wallets, phones or the merchant stamp', () => {
    const allowed = [/^9\d{10}$/, /^999\d{6}$/, /^(?:\+?233|0)20000\d*$/, /^\d{12}$/];
    for (const run of texts.flatMap((text) => text.match(DIGIT_RUN) ?? [])) {
      expect(allowed.some((pattern) => pattern.test(run))).toBe(true);
    }
  });

  // The denylist is every real word the anonymiser scrambled. It lives in .local (git-ignored), written by
  // scripts/anonymise-sms.ts; point SMS_DENYLIST elsewhere to use another copy. Without it this part skips.
  const denylistPath = process.env.SMS_DENYLIST ?? join(ROOT, '.local', 'sms-denylist.txt');
  (existsSync(denylistPath) ? it : it.skip)(
    'contains no word from the local denylist of real names',
    () => {
      const denied = new Set(readFileSync(denylistPath, 'utf8').split('\n').filter(Boolean));
      const words = texts.flatMap(
        (text) =>
          text
            .replace(/https?:\/\/\S+/g, ' ')
            .toLowerCase()
            .match(/\p{L}{3,}/gu) ?? [],
      );
      expect(words.filter((word) => denied.has(word))).toEqual([]);
    },
  );
});
