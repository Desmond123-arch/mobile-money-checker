import { JUNK_REFERENCES } from '../reference';
import { SEED_KEYWORDS } from '../seed';

const all = SEED_KEYWORDS.flatMap((s) => [...s.words, ...(s.aliases ?? [])]);

describe('seed keywords', () => {
  it('lists no word twice, in any category', () => {
    const seen = new Set<string>();
    const dupes = all.filter((w) => (seen.has(w) ? true : (seen.add(w), false)));
    expect(dupes).toEqual([]);
  });

  it('never lists a word that is also junk', () => {
    expect(all.filter((w) => JUNK_REFERENCES.has(w))).toEqual([]);
  });

  it('is lowercase and single-spaced, as the keywords table requires', () => {
    expect(
      all.filter((w) => w !== w.toLowerCase().trim().replace(/\s+/g, ' ') || w === ''),
    ).toEqual([]);
  });

  it('puts duplicated words in the first category that listed them', () => {
    const owner = (word: string) => SEED_KEYWORDS.find((s) => s.words.includes(word))?.systemKey;
    expect(owner('market')).toBe('food');
    expect(owner('printing')).toBe('education');
    expect(owner('fufu')).toBe('food');
  });
});
