import { fuzzyDistance } from './fuzzy';

export interface MatchEntry<T> {
  value: string;
  /** Lower ranks win ties. */
  rank: number;
  exactOnly: boolean;
  tag: T;
}

interface Candidate<T> {
  tag: T;
  distance: number;
  rank: number;
}

export interface Matcher<T> {
  match(tokens: readonly string[]): { tag: T; distance: number } | null;
}

const LETTERS = /^\p{L}+$/u;
const MAX_PHRASE_WORDS = 4;

const better = <T>(a: Candidate<T>, b: Candidate<T> | null) =>
  b === null || a.distance < b.distance || (a.distance === b.distance && a.rank < b.rank);

/**
 * Spaces are dropped from both sides, so `ground nut` and `groundnut` meet. Exact matches beat
 * fuzzy ones; within a distance the lowest rank wins. Phrases are runs of adjacent tokens.
 */
export function createMatcher<T>(entries: readonly MatchEntry<T>[]): Matcher<T> {
  const exact = new Map<string, Candidate<T>>();
  const fuzzy: { key: string; cand: Candidate<T> }[] = [];
  for (const e of entries) {
    const key = e.value.replace(/\s+/g, '');
    const cand = { tag: e.tag, distance: 0, rank: e.rank };
    const seen = exact.get(key);
    if (!seen || e.rank < seen.rank) exact.set(key, cand);
    if (!e.exactOnly && LETTERS.test(key)) fuzzy.push({ key, cand });
  }

  return {
    match(tokens) {
      let best: Candidate<T> | null = null;
      for (let start = 0; start < tokens.length; start++) {
        let phrase = '';
        for (let n = 0; n < MAX_PHRASE_WORDS && start + n < tokens.length; n++) {
          phrase += tokens[start + n]!;
          const hit = exact.get(phrase);
          if (hit && better(hit, best)) best = hit;
        }
      }
      if (best) return best;

      for (const token of tokens) {
        if (!LETTERS.test(token)) continue;
        for (const { key, cand } of fuzzy) {
          const d = fuzzyDistance(token, key);
          if (d === null) continue;
          const found = { tag: cand.tag, distance: d, rank: cand.rank };
          if (better(found, best)) best = found;
        }
      }
      return best;
    },
  };
}
