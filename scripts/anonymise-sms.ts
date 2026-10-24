// Dev tool: turn a private SMS Backup & Restore export into the committed fixtures in fixtures/sms.
// Usage: node scripts/anonymise-sms.ts /path/to/sms-export.xml   (then: npx prettier --write fixtures)
//
// What changes: every word outside the template vocabulary (names, merchants, free-text notes) becomes a
// fake word, the same real word always the same fake one; transaction ids, merchant codes, wallet numbers
// and phone numbers are remapped consistently (same-id pairs stay pairs, and phone numbers land in the
// fake range documented in fixtures/sms/README.md); every balance moves by one constant, so
// before - (amount + fee + tax) = after still holds. Amounts, fees, times and layout are kept.
// The list of real words that were scrambled goes to .local/sms-denylist.txt (git-ignored) so the
// fixtures test can prove none survived.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatPlain, parseAmount } from '../src/domain/money';
import { mergeAll } from '../src/domain/parse/merge';
import { parseSms } from '../src/domain/parse/parse';
import { reconcileBalances } from '../src/domain/parse/reconcile';
import type { ParseResult, RawSms } from '../src/domain/parse/types';
import { readMobileMoney } from './lib/smsXml';
import { ROOT, safeWords, skeleton, WORD } from './lib/vocab';

const BALANCE_SHIFT = 777_123;
const MIN_PER_SHAPE = 6;
const MAX_LAYOUTS = 8;
const DAY = 24 * 60 * 60 * 1000;
const SYLLABLES = ['ba', 'ke', 'lo', 'mi', 'nu', 'sa', 'te', 'vo', 'zu', 'di', 'fa', 'gu'];

const path = process.argv[2];
if (path === undefined) {
  console.error('usage: node scripts/anonymise-sms.ts <sms-export.xml>');
  process.exit(2);
}

const safe = safeWords();
const URL_OR_WORD = new RegExp(String.raw`(https?:\/\/\S+)|${WORD.source}`, 'gu');

function realWordsIn(body: string): string[] {
  return [...body.replaceAll(/https?:\/\/\S+/g, ' ').matchAll(WORD)]
    .map((match) => match[0].toLowerCase())
    .filter((word) => !safe.has(word));
}

function counterMap(make: (n: number) => string) {
  const known = new Map<string, string>();
  return (key: string) => {
    let value = known.get(key);
    if (value === undefined) {
      value = make(known.size);
      known.set(key, value);
    }
    return value;
  };
}

const fakeId = counterMap((n) => `9${String((n * 7919 + 1_000_003) % 1e10).padStart(10, '0')}`);
const fakeUuid = counterMap((n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`);
const fakeMerchant = counterMap((n) => `09${String(n).padStart(4, '0')}`);
const fakeWallet = counterMap((n) => `999${String(n).padStart(6, '0')}`);
const fakeNsn = counterMap((n) => `20000${String(n).padStart(4, '0')}`);

function fakePhone(real: string): string {
  // Any other long number (an account or card number in a note) goes into the same fake range.
  const prefix = real.startsWith('+233') ? '+233' : real.startsWith('233') ? '233' : '0';
  return `${prefix}${fakeNsn(real.replace(/^\+/, ''))}`.padEnd(real.length, '0');
}

function shiftBalance(token: string): string {
  const pesewas = parseAmount(token);
  return pesewas === null ? token : formatPlain((pesewas + BALANCE_SHIFT) as typeof pesewas);
}

function fakeWordFor(index: number): string {
  let digits = 3;
  while (12 ** digits <= index) digits += 1;
  return Array.from({ length: digits }, (_, i) => SYLLABLES[Math.floor(index / 12 ** i) % 12]).join(
    '',
  );
}

function matchCase(original: string, fake: string): string {
  if (original === original.toUpperCase()) return fake.toUpperCase();
  if (original[0] === (original[0] ?? '').toUpperCase())
    return fake[0]?.toUpperCase() + fake.slice(1);
  return fake;
}

function buildWordMap(bodies: string[]): (word: string) => string {
  const real = [...new Set(bodies.flatMap(realWordsIn))].sort();
  const taken = new Set([...real, ...safe]);
  const map = new Map<string, string>();
  let next = 0;
  for (const word of real) {
    let fake = fakeWordFor(next++);
    while (taken.has(fake)) fake = fakeWordFor(next++);
    map.set(word, fake);
  }
  return (word) => matchCase(word, map.get(word.toLowerCase()) ?? word);
}

function anonymiseBody(
  body: string,
  receivedAt: number,
  scramble: (word: string) => string,
): string {
  const stamp = new Date(receivedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const merchantStamp = `${stamp.getUTCFullYear()}${pad(stamp.getUTCDate())}${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}`;
  return body
    .replace(/(transaction\s+id\s*:?\s*)(\d{6,})/gi, (_, label, id) => label + fakeId(id))
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (id) =>
      fakeUuid(id),
    )
    .replace(/(merchant\s+)(\d+)/gi, (_, label, code) => label + fakeMerchant(code))
    .replace(/(account\s+)(\d{6,})(?= at )/g, (_, label, wallet) => label + fakeWallet(wallet))
    .replace(/(account at )\d{12}/g, (_, label) => label + merchantStamp)
    .replace(
      /(?<!transaction\s+id\s*:?\s*)(?<!account\s+)(?<!account at )(?<![\d+])\+?\d{9,}(?!\d)/gi,
      fakePhone,
    )
    .replace(
      /((?:current|available) balance|your new balance(?: is)?)(\s*:?\s*(?:GH[SC]\s*)?)(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
      (_, label, gap, value) => label + gap + shiftBalance(value),
    )
    .replace(URL_OR_WORD, (match, url) =>
      url !== undefined || safe.has(match.toLowerCase()) ? match : scramble(match),
    );
}

interface Entry {
  shape: string;
  real: RawSms;
  anon: RawSms;
  result: ParseResult;
  layout: string;
  synthetic: boolean;
}

function shapeOf(result: ParseResult): string | null {
  if (result.status === 'parsed') return result.fragment.template.name;
  return result.status === 'ignored' && result.reason === 'failed' ? 'failed' : null;
}

function checkSameStructure(
  real: ParseResult,
  anon: ParseResult,
  realBody: string,
  anonBody: string,
): void {
  const fail = (what: string) => {
    throw new Error(
      `anonymisation changed ${what}: ${skeleton(realBody)} -> ${skeleton(anonBody)}`,
    );
  };
  if (real.status !== anon.status) fail('the parse status');
  if (real.status !== 'parsed' || anon.status !== 'parsed') return;
  const a = real.fragment;
  const b = anon.fragment;
  for (const key of ['kind', 'direction', 'amount', 'fee', 'tax'] as const)
    if (a[key] !== b[key]) fail(key);
  if (a.template.name !== b.template.name) fail('template');
  if (a.occurredAt.source !== b.occurredAt.source || a.occurredAt.at !== b.occurredAt.at)
    fail('occurredAt');
  if ((a.balanceAfter === null) !== (b.balanceAfter === null)) fail('balance presence');
  if (a.balanceAfter !== null && b.balanceAfter !== a.balanceAfter + BALANCE_SHIFT)
    fail('balance shift');
  for (const key of [
    'counterpartyName',
    'merchantCode',
    'counterpartyNumber',
    'reference',
  ] as const) {
    if ((a[key] === null) !== (b[key] === null)) fail(`${key} presence`);
  }
}

const all = readMobileMoney(path);
const realBodies = all.map((sms) => sms.body);
const scramble = buildWordMap(realBodies);

const entries: Entry[] = [];
for (const real of all) {
  const realResult = parseSms(real);
  const shape = shapeOf(realResult);
  if (shape === null) continue;
  const anon: RawSms = { ...real, body: anonymiseBody(real.body, real.receivedAt, scramble) };
  const result = parseSms(anon);
  checkSameStructure(realResult, result, real.body, anon.body);
  entries.push({ shape, real, anon, result, layout: '', synthetic: false });
}

const fragmentsOf = (list: Entry[]) =>
  list.flatMap((entry) => (entry.result.status === 'parsed' ? [entry.result.fragment] : []));
function reconciliation(fragments: ReturnType<typeof fragmentsOf>) {
  const groups = new Map<string, typeof fragments>();
  for (const fragment of fragments) {
    groups.set(fragment.momoTxnId, [...(groups.get(fragment.momoTxnId) ?? []), fragment]);
  }
  const first = new Map(fragments.map((fragment, index) => [fragment.momoTxnId, index]));
  const merged = [...groups.entries()]
    .sort(([a], [b]) => (first.get(a) ?? 0) - (first.get(b) ?? 0))
    .map(([, group]) => mergeAll(group));
  return reconcileBalances(merged);
}
const realFragments = all.flatMap((sms) => {
  const result = parseSms(sms);
  return result.status === 'parsed' ? [result.fragment] : [];
});
const before = reconciliation(realFragments);
const after = reconciliation(fragmentsOf(entries));
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('reconciliation changed');
console.log(`reconciliation unchanged by the balance shift: ${JSON.stringify(after)}`);

const byShape = new Map<string, Entry[]>();
for (const entry of entries) byShape.set(entry.shape, [...(byShape.get(entry.shape) ?? []), entry]);

const chosen = new Set<Entry>();
for (const [shape, list] of byShape) {
  const layouts = new Map<string, Entry[]>();
  for (const entry of list) {
    const key = skeleton(entry.anon.body, safe);
    layouts.set(key, [...(layouts.get(key) ?? []), entry]);
  }
  [...layouts.values()]
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_LAYOUTS)
    .forEach((group, index) => {
      const entry = group[0] as Entry;
      entry.layout = `v${index + 1}`;
      chosen.add(entry);
    });
  const rest = list.filter((entry) => !chosen.has(entry));
  const needed = MIN_PER_SHAPE - list.filter((entry) => chosen.has(entry)).length;
  for (let i = 0; i < needed && rest.length > 0; i++) {
    const entry = rest[Math.floor((i * rest.length) / needed)] as Entry;
    entry.layout = 'extra';
    chosen.add(entry);
  }
  console.log(`${shape}: ${list.length} messages, ${layouts.size} layouts`);
}

const idOf = (entry: Entry) =>
  entry.result.status === 'parsed' ? entry.result.fragment.momoTxnId : null;
const chosenIds = new Set<string | null>([...chosen].map(idOf));
for (const entry of entries) {
  if (!chosen.has(entry) && idOf(entry) !== null && chosenIds.has(idOf(entry))) {
    entry.layout = 'pair';
    chosen.add(entry);
  }
}

const AMOUNTS = ['1.00', '2.50', '7.00', '12.00', '20.00', '45.50'];
function synthesise(base: Entry, index: number): Entry {
  const shift = (index + 1) * DAY;
  const stamp = (text: string) =>
    text.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, (time) =>
      new Date(Date.parse(`${time.replace(' ', 'T')}Z`) + shift)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' '),
    );
  const body = stamp(base.anon.body)
    .replace(/(?:of|refunded) GHS\s?\d[\d,.]*/, (head) =>
      head.replace(/\d[\d,.]*$/, AMOUNTS[index % AMOUNTS.length] as string),
    )
    .replace(
      /(transaction\s+id\s*:?\s*)(\d{6,})/i,
      (_, label) => label + fakeId(`synthetic-${base.shape}-${index}`),
    );
  const anon: RawSms = { ...base.anon, body, receivedAt: base.anon.receivedAt + shift };
  return { ...base, anon, result: parseSms(anon), layout: 'synthetic', synthetic: true };
}

const files = new Map<string, Entry[]>();
for (const [shape, list] of byShape) {
  const picked = list.filter((entry) => chosen.has(entry));
  for (let i = 0; picked.length < MIN_PER_SHAPE; i++)
    picked.push(synthesise(picked[i % list.length] as Entry, i));
  files.set(shape, picked);
}

const outDir = join(ROOT, 'fixtures', 'sms');
mkdirSync(outDir, { recursive: true });
for (const [shape, list] of files) {
  const messages = list.map((entry, index) => ({
    layout: entry.layout,
    synthetic: entry.synthetic,
    sms: { ...entry.anon, androidId: `fx-${shape}-${index + 1}` },
    expected:
      entry.result.status === 'parsed'
        ? {
            status: 'parsed',
            fragment: { ...entry.result.fragment, androidId: `fx-${shape}-${index + 1}` },
          }
        : entry.result,
  }));
  writeFileSync(join(outDir, `${shape}.json`), `${JSON.stringify({ shape, messages }, null, 2)}\n`);
  console.log(`wrote fixtures/sms/${shape}.json (${messages.length} messages)`);
}

const localDir = join(ROOT, '.local');
mkdirSync(localDir, { recursive: true });
const denylist = [...new Set(realBodies.flatMap(realWordsIn))]
  .filter((word) => word.length >= 3)
  .sort();
writeFileSync(join(localDir, 'sms-denylist.txt'), `${denylist.join('\n')}\n`);
console.log(`wrote .local/sms-denylist.txt (${denylist.length} words, git-ignored)`);
