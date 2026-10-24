/** Damerau-Levenshtein with adjacent transposition (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/** Edits a token of this many letters may differ from a keyword by. Under 5 letters: exact only. */
export function allowedEdits(letters: number): number {
  if (letters < 5) return 0;
  return letters <= 8 ? 1 : 2;
}

/**
 * Edit distance when `token` is an acceptable misspelling of `keyword`, else null. Edits may not
 * touch the first or last letter, which is what keeps `paste` away from `waste` and `charges`
 * away from `charger`.
 */
export function fuzzyDistance(token: string, keyword: string): number | null {
  const max = allowedEdits(token.length);
  if (max === 0 || keyword.length < 2) return null;
  if (token[0] !== keyword[0] || token[token.length - 1] !== keyword[keyword.length - 1]) {
    return null;
  }
  const d = editDistance(token, keyword);
  return d >= 1 && d <= max ? d : null;
}
