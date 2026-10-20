import { formatGhs, parseAmount, pesewas, totalDebited } from '../money';

describe('parseAmount', () => {
  // Every format below appears in the real MoMo export (one-decimal and no-decimal amounts included).
  it.each([
    ['GHS 103.00', 10300],
    ['GHS3.00', 300],
    ['GHS 10', 1000],
    ['GHS 2.5', 250],
    ['10.00 GHS', 1000],
    ['GHC 5.00', 500],
    ['GHS 1,240.50', 124050],
    ['1,240.50', 124050],
    ['GHS 0.', 0],
    ['GHS0.00', 0],
    ['0.05', 5],
    ['GHS 10.', 1000],
    ['103.00.', 10300],
    ['  GHS 7.25  ', 725],
  ])('parses %j as %i pesewas', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each([
    ['-'],
    ['GHS -'],
    [''],
    ['.'],
    ['GHS'],
    ['abc'],
    ['-5.00'],
    ['12.345'],
    ['1.2.3'],
    ['1,24'],
    ['1,2345.00'],
    ['99999999999999999999'],
  ])('returns null for %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });

  it('never goes through floating point (0.1 + 0.2 style traps)', () => {
    expect(parseAmount('GHS 0.30')).toBe(30);
    expect(parseAmount('GHS 1.15')).toBe(115);
    expect(parseAmount('GHS 4.35')).toBe(435);
    expect(parseAmount('GHS 19.99')).toBe(1999);
  });
});

describe('formatGhs', () => {
  it.each([
    [0, 'GHS 0.00'],
    [5, 'GHS 0.05'],
    [100, 'GHS 1.00'],
    [124050, 'GHS 1,240.50'],
    [100000000, 'GHS 1,000,000.00'],
    [-250, '-GHS 2.50'],
  ])('formats %i as %j', (value, expected) => {
    expect(formatGhs(pesewas(value))).toBe(expected);
  });
});

describe('parseAmount and formatGhs round trip', () => {
  it('returns the same pesewas for many amounts, with and without the currency prefix', () => {
    // Deterministic pseudo-random sequence (LCG) so a failure is reproducible.
    let seed = 12345;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed;
    };
    for (let i = 0; i < 2000; i += 1) {
      const value = next() % 100_000_000; // up to GHS 1,000,000.00
      const text = formatGhs(pesewas(value));
      expect(parseAmount(text)).toBe(value);
      expect(parseAmount(text.replace('GHS ', ''))).toBe(value);
    }
  });
});

describe('totalDebited', () => {
  it('adds the fee and tax on top of the amount', () => {
    expect(totalDebited(pesewas(3200), pesewas(16), pesewas(0))).toBe(3216);
    expect(totalDebited(pesewas(35000), pesewas(350), pesewas(250))).toBe(35600);
  });
});

describe('pesewas', () => {
  it.each([[1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [2 ** 60]])('rejects %p', (value) => {
    expect(() => pesewas(value)).toThrow(RangeError);
  });

  it('accepts zero and negative integers', () => {
    expect(pesewas(0)).toBe(0);
    expect(pesewas(-250)).toBe(-250);
  });
});
