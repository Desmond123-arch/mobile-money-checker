import { allowedEdits, editDistance, fuzzyDistance } from '../fuzzy';
import { cleanReference, tokenise } from '../reference';
import { isSelfTransfer } from '../self';

describe('editDistance', () => {
  it('counts a swapped pair as one edit', () => {
    expect(editDistance('noodles', 'nodoles')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('fuzzyDistance', () => {
  it('scales the allowed edits with token length', () => {
    expect([4, 5, 8, 9].map(allowedEdits)).toEqual([0, 1, 1, 2]);
    expect(fuzzyDistance('groundnuts', 'groundnut')).toBeNull();
    expect(fuzzyDistance('groudnutt', 'groundnut')).toBe(2);
  });

  it('refuses edits at the first or last letter', () => {
    expect(fuzzyDistance('paste', 'waste')).toBeNull();
    expect(fuzzyDistance('charges', 'charger')).toBeNull();
    expect(fuzzyDistance('batter', 'battery')).toBeNull();
  });

  it('does not report an exact match as a typo', () => {
    expect(fuzzyDistance('lunch', 'lunch')).toBeNull();
  });
});

describe('cleanReference', () => {
  it('keeps the case of what was typed and collapses spaces', () => {
    expect(cleanReference('  Fried   Rice ')).toBe('Fried Rice');
  });
  it('keeps only the last comma part', () => {
    expect(cleanReference('Kofi,233244000000,Lunch')).toBe('Lunch');
  });
  it('returns null for junk and null', () => {
    expect(cleanReference('MoMo')).toBeNull();
    expect(cleanReference(null)).toBeNull();
  });
});

describe('tokenise', () => {
  it('splits on anything that is not a letter or digit', () => {
    expect(tokenise('Bread+Egg, 2x')).toEqual(['bread', 'egg', '2x']);
  });
});

describe('isSelfTransfer', () => {
  const none = { number: null, name: null };
  it('is false while the owner is unknown', () => {
    expect(isSelfTransfer({ name: 'Kofi', number: '233244000000' }, none)).toBe(false);
  });
  it('matches a number across 0 and 233 prefixes', () => {
    const owner = { number: '0244000000', name: null };
    expect(isSelfTransfer({ name: null, number: '233244000000' }, owner)).toBe(true);
    expect(isSelfTransfer({ name: null, number: '233244000001' }, owner)).toBe(false);
  });
  it('matches a name ignoring case and spacing', () => {
    const owner = { number: null, name: 'Desmond  Mends' };
    expect(isSelfTransfer({ name: 'DESMOND MENDS', number: null }, owner)).toBe(true);
    expect(isSelfTransfer({ name: 'Someone Else', number: null }, owner)).toBe(false);
  });
});
