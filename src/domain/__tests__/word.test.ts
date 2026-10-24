import { isHexColor, normaliseWord, tintOf } from '../category/word';

describe('normaliseWord', () => {
  it('lowercases, trims and collapses spaces', () => {
    expect(normaliseWord('  Fried   RICE ')).toBe('fried rice');
    expect(normaliseWord('   ')).toBe('');
  });
});

describe('tintOf', () => {
  it('mixes toward white and stays a valid colour', () => {
    expect(tintOf('#000000')).toBe('#D1D1D1');
    expect(tintOf('#FFFFFF')).toBe('#FFFFFF');
    expect(isHexColor(tintOf('#6250D6'))).toBe(true);
  });
});

describe('isHexColor', () => {
  it('accepts six hex digits with a hash only', () => {
    expect(isHexColor('#1bAf7A')).toBe(true);
    expect(isHexColor('1BAF7A')).toBe(false);
    expect(isHexColor('#FFF')).toBe(false);
    expect(isHexColor('#GGGGGG')).toBe(false);
  });
});
