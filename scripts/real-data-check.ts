// Dev tool: run the parser over a private SMS Backup & Restore export and print aggregate numbers only.
// Usage: npm run check:sms -- /path/to/sms-export.xml
// Message text is never printed; unparsed shapes are shown as redacted skeletons.
import { mergeAll } from '../src/domain/parse/merge';
import { parseSms } from '../src/domain/parse/parse';
import type { ParsedFragment, RawSms } from '../src/domain/parse/types';
import { linkReversals } from '../src/domain/parse/reversal';
import { reconcileBalances } from '../src/domain/parse/reconcile';
import { readMobileMoney } from './lib/smsXml';
import { safeWords, skeleton } from './lib/vocab';

function tally<K>(items: K[]): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

const path = process.argv[2];
if (path === undefined) {
  console.error('usage: npm run check:sms -- <sms-export.xml>');
  process.exit(2);
}

const safe = safeWords();
const messages: RawSms[] = readMobileMoney(path);
const results = messages.map((sms) => ({ sms, result: parseSms(sms) }));

const status = tally(results.map(({ result }) => result.status));
const ignored = tally(
  results.flatMap(({ result }) => (result.status === 'ignored' ? [result.reason] : [])),
);
const fragments: ParsedFragment[] = results.flatMap(({ result }) =>
  result.status === 'parsed' ? [result.fragment] : [],
);
const parsed = fragments.length;
const unparsed = status.get('unparsed') ?? 0;
const failed = ignored.get('failed') ?? 0;
const labelled = parsed + unparsed + failed;

console.log(`messages from MobileMoney: ${messages.length}`);
console.log(`by status: ${[...status].map(([k, v]) => `${k}=${v}`).join(', ')}`);
console.log(`ignored by reason: ${[...ignored].map(([k, v]) => `${k}=${v}`).join(', ')}`);
console.log(
  `messages with a transaction-id label: ${labelled} (parsed ${parsed}, unparsed ${unparsed}, failed ${failed})`,
);
console.log(
  `parse rate: ${((parsed / labelled) * 100).toFixed(2)}% (excluding failed: ${((parsed / (labelled - failed)) * 100).toFixed(2)}%)`,
);
console.log(
  `by template: ${[...tally(fragments.map((f) => f.template.name))].map(([k, v]) => `${k}=${v}`).join(', ')}`,
);
console.log(
  `by kind: ${[...tally(fragments.map((f) => f.kind))].map(([k, v]) => `${k}=${v}`).join(', ')}`,
);

const skeletons = tally(
  results.flatMap(({ sms, result }) =>
    result.status === 'unparsed' ? [skeleton(sms.body, safe)] : [],
  ),
);
console.log(`unparsed shapes (${skeletons.size}):`);
for (const [shape, count] of [...skeletons].sort((a, b) => b[1] - a[1]))
  console.log(`  ${count}x ${shape}`);

const byId = new Map<string, ParsedFragment[]>();
for (const fragment of fragments)
  byId.set(fragment.momoTxnId, [...(byId.get(fragment.momoTxnId) ?? []), fragment]);
const merged = [...byId.values()]
  .map((group) => mergeAll(group))
  .sort((a, b) => a.occurredAt.at - b.occurredAt.at);
const multi = [...byId.values()].filter((group) => group.length > 1);
console.log(`transactions: ${merged.length} (ids with more than one message: ${multi.length})`);
console.log(
  `merge conflicts (amount or kind disagree): ${merged.filter((txn) => txn.hasConflict).length}`,
);

const fragmentOrder = new Map(fragments.map((fragment, index) => [fragment.momoTxnId, index]));
const inFileOrder = merged
  .slice()
  .sort((a, b) => (fragmentOrder.get(a.momoTxnId) ?? 0) - (fragmentOrder.get(b.momoTxnId) ?? 0));
const rec = reconcileBalances(inFileOrder);
console.log(
  `balance reconciliation over consecutive outgoing payments: ${rec.total} pairs, ${rec.amountOnly} on amount alone, ${rec.withCharges} with fee and tax, ${rec.mismatch} do not reconcile`,
);

const links = linkReversals(
  merged.map((txn) => ({
    momoTxnId: txn.momoTxnId,
    kind: txn.kind,
    amount: txn.amount,
    counterpartyName: txn.counterpartyName,
    occurredAt: txn.occurredAt.at,
  })),
);
const credits = merged.filter((txn) => txn.kind === 'reversal' || txn.kind === 'refund').length;
console.log(
  `reversals and refunds: ${credits}, linked ${links.length} (${links.filter((link) => link.ambiguous).length} ambiguous)`,
);
