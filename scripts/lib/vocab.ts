import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBody } from '../../src/domain/parse/normalize';

export const ROOT = join(import.meta.dirname, '..', '..');

/** Words the MoMo templates themselves use, plus business and brand words that carry no personal information. */
const TEMPLATE_WORDS = `
payment made for to current balance available fee charged tax was your new is transaction id financial
external reference you have paid ghs ghc on message from sender cash out in received an amount of has been
credited successfully refunded reversed with transferred other networks at completed failed and the a
account mobile money mtn momo download app faster easier experience click here hello valued customer
transfer receiver refunder please do not pay any fees agent thank using mobilemoney automatically wallet
free deposit it dear yello transactionid
enterprise enterprises ventures venture limited ltd company consult consulting services service shop store
food joint kitchen pharmacy chemist clinic fuel filling station trading bank ghana ova gcb
bundle mtnbundle airtime telecel vodafone push bankpush paystack bills inv just networks cis one sp
january february march april may june july august september october november december interest
recharge sms ussd ello merchant all refund reversal reversed
`;

/** Seed keywords from docs/categorisation.md, so a reference like "bread" or "trotro" survives anonymisation. */
function categorisationKeywords(): string[] {
  const doc = readFileSync(join(ROOT, 'docs', 'categorisation.md'), 'utf8');
  const words: string[] = [];
  for (const line of doc.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 4 || cells[2] === undefined || !/^[A-Z]/.test(cells[1] ?? '')) continue;
    if (!line.includes(',')) continue;
    words.push(...cells[2].split(/[^\p{L}]+/u));
  }
  return words;
}

const JUNK_REFERENCES = 'momo no merchantpay my number stuff direct debit credit airtime data';

export function safeWords(): Set<string> {
  const all = [
    ...TEMPLATE_WORDS.split(/\s+/),
    ...JUNK_REFERENCES.split(' '),
    ...categorisationKeywords(),
  ];
  return new Set(all.map((word) => word.toLowerCase()).filter((word) => word.length > 0));
}

/** Two or more letters; an apostrophe or hyphen splits words, so "Y'ello" and "Cash-out" are two each. */
export const WORD = /\p{L}{2,}/gu;

/**
 * Keep the frame of a message and hide the content: digits become 9 and every word outside the template
 * vocabulary becomes x. Safe to print.
 */
export function skeleton(body: string, safe: Set<string> = safeWords()): string {
  return normalizeBody(body)
    .replace(/https?:\/\/\S+/g, 'URL')
    .replace(/\d+(?:[.,]\d+)*/g, '9')
    .replace(WORD, (word) => (safe.has(word.toLowerCase()) ? word : 'x'))
    .replace(/(?:x[\s.,]*){2,}/g, 'x ');
}
