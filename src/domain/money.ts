/**
 * Money is integer pesewas end to end (GHS 12.50 = 1250). Amounts are parsed from text with string
 * and integer arithmetic only, never through floating point.
 */
export type Pesewas = number & { readonly __brand: 'Pesewas' };

/** Wrap a number that must already be a safe integer. Throws on anything else (a bug, not user input). */
export function pesewas(n: number): Pesewas {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Pesewas must be a safe integer, got ${n}`);
  }
  return n as Pesewas;
}

const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`;
const CURRENCY = String.raw`GH[SC]`;
// One number, with at most one currency token before it OR after it, and an optional sentence-final dot.
// Spaces are only allowed around the currency token, never inside the number, so "10 20" is not 1020.
const PREFIXED = new RegExp(String.raw`^${CURRENCY}\s*(${NUMBER})\.*$`, 'i');
const SUFFIXED = new RegExp(String.raw`^(${NUMBER})\s*(?:${CURRENCY})?\.*$`, 'i');

/**
 * Parse an amount token as it appears in an MTN MoMo SMS into pesewas.
 *
 * Accepts `GHS 103.00`, `GHS3.00`, `GHS 10`, `GHS 2.5` (250), `10.00 GHS`, `GHC 5.00`, `1,240.50`,
 * `GHS 0.` and a sentence-final dot (`GHS 10.`). Returns null for anything that is not a plain
 * non-negative amount: `-`, `GHS -`, empty, negatives, more than two decimals, misplaced commas,
 * values too large to hold exactly. Callers decide what null means: a null main amount fails the
 * template; a null fee or tax means the message did not say.
 */
export function parseAmount(text: string): Pesewas | null {
  const trimmed = text.trim();
  const match = PREFIXED.exec(trimmed) ?? SUFFIXED.exec(trimmed);
  const digits = match?.[1];
  if (digits === undefined) return null;

  const [whole = '', fraction = ''] = digits.replace(/,/g, '').split('.');
  const total = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? (total as Pesewas) : null;
}

/** `GHS 1,240.50`. Negative values render as `-GHS 2.50`. */
export function formatGhs(amount: Pesewas): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.trunc(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}GHS ${whole}.${fraction}`;
}

/** What actually left the wallet: the amount plus the fee and tax charged on top of it. Never stored. */
export function totalDebited(amount: Pesewas, fee: Pesewas, tax: Pesewas): Pesewas {
  return pesewas(amount + fee + tax);
}
