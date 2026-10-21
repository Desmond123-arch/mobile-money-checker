// A reference that says nothing. `credit` is deliberately absent: it is an Airtime & Data keyword.
export const JUNK_REFERENCES: ReadonlySet<string> = new Set([
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
]);

/**
 * The note a person wrote, or null when there is none. A `name,number,note` reference keeps only
 * the note. Case is kept so the transaction list can show what was typed; matching lowercases.
 */
export function cleanReference(raw: string | null): string | null {
  if (raw === null) return null;
  const parts = raw.split(',');
  const last = (parts[parts.length - 1] ?? '').replace(/\s+/g, ' ').trim();
  return JUNK_REFERENCES.has(last.toLowerCase()) ? null : last;
}

/** Splits on anything that is not a letter or digit, so `bread+egg` gives `bread`, `egg`. */
export function tokenise(clean: string): string[] {
  return clean
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '');
}
