// Dev tool: ingest a private SMS Backup & Restore export into an in-memory database and report how
// the categoriser did on outgoing, non-cash-out transactions. Aggregates only: no names, numbers or
// message text are printed, and unmatched references are shown as redacted skeletons.
// Usage: npm run check:categories -- /path/to/sms-export.xml
import { migrate } from '../src/data/migrate';
import { MIGRATIONS } from '../src/data/migrations';
import { seedDatabase } from '../src/data/seed';
import { openNodeDb } from '../src/data/__tests__/nodeDb';
import { editDistance } from '../src/domain/categorise/fuzzy';
import { cleanReference, tokenise } from '../src/domain/categorise/reference';
import { finishImport } from '../src/ledger/finishImport';
import { ingest } from '../src/ledger/ingest';
import { readMobileMoney } from './lib/smsXml';
import { safeWords } from './lib/vocab';

const path = process.argv[2];
if (path === undefined) {
  console.error('usage: npm run check:categories -- <sms-export.xml>');
  process.exit(2);
}

const db = openNodeDb();
await migrate(db, MIGRATIONS);
await seedDatabase(db);
const messages = readMobileMoney(path);
for (let i = 0; i < messages.length; i += 200) {
  await ingest(
    db,
    messages
      .slice(i, i + 200)
      .map((m) => ({ source: 'backup' as const, body: m.body, receivedAt: m.receivedAt })),
  );
}
await finishImport(db);

interface Row {
  key: string;
  source: string;
  sms_reference: string | null;
  reference_clean: string | null;
}
const rows = await db.all<Row>(
  `SELECT c.system_key AS key, t.auto_category_source AS source, t.sms_reference, t.reference_clean
   FROM transactions t JOIN categories c ON c.id = t.auto_category_id
   WHERE t.origin = 'sms' AND t.flow = 'spend' AND t.kind <> 'cash_out' AND t.retracted_at IS NULL`,
);

const count = <K>(items: K[]) => {
  const m = new Map<K, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const pct = (n: number) => `${((n / rows.length) * 100).toFixed(1)}%`;

console.log(`outgoing, non-cash-out transactions: ${rows.length}`);
console.log('by category:');
for (const [key, n] of count(rows.map((r) => r.key))) {
  console.log(`  ${key.padEnd(14)} ${String(n).padStart(5)}  ${pct(n)}`);
}
console.log('by source:');
for (const [source, n] of count(rows.map((r) => r.source))) {
  console.log(`  ${source.padEnd(14)} ${String(n).padStart(5)}  ${pct(n)}`);
}
const fromReference = rows.filter((r) => r.source === 'keyword' || r.source === 'rule').length;
const notMisc = rows.filter((r) => r.key !== 'misc').length;
console.log(
  `categorised from the reference (keyword or rule): ${fromReference} (${pct(fromReference)})`,
);
console.log(`categorised without falling to Misc: ${notMisc} (${pct(notMisc)})`);
const emptyRef = rows.filter((r) => cleanReference(r.sms_reference) === null).length;
console.log(`empty reference: ${emptyRef} (${pct(emptyRef)})`);

// A word outside the template vocabulary becomes w<letters>; digits become 9.
const safe = safeWords();
const shape = (reference: string) =>
  reference
    .toLowerCase()
    .replace(/\d+/g, '9')
    .replace(/\p{L}+/gu, (w) => (safe.has(w) ? w : `w${w.length}`));
const unmatched = rows.filter((r) => r.key === 'misc' && r.reference_clean !== null);
console.log(`non-empty references that fell to Misc: ${unmatched.length}`);
console.log('top 15 unmatched reference skeletons:');
for (const [skeleton, n] of count(unmatched.map((r) => shape(r.reference_clean!))).slice(0, 15)) {
  console.log(`  ${String(n).padStart(4)}x ${skeleton}`);
}

// Counts only: references the first/last-letter rule rejected although plain distance 1 would match.
const keywords = (
  await db.all<{ value: string }>('SELECT value FROM keywords WHERE is_alias = 0')
).map((k) => k.value.replace(/\s+/g, ''));
const nearMisses = unmatched.filter((r) =>
  tokenise(r.reference_clean!).some(
    (t) => t.length >= 4 && keywords.some((k) => editDistance(t, k) === 1),
  ),
).length;
console.log(`unmatched references within one plain edit of a keyword: ${nearMisses}`);
