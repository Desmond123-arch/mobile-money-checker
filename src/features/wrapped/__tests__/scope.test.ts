import { parseWrappedScope, stepSlide, wrappedParams } from '../scope';

describe('parseWrappedScope', () => {
  it.each([
    [['year', '2025'], { kind: 'year', year: 2025 }],
    [['all', undefined], { kind: 'all' }],
    [['all', '2025'], { kind: 'all' }],
    [[['year'], ['2024']], { kind: 'year', year: 2024 }],
    [['year', undefined], null],
    [['year', '25'], null],
    [['year', '2025x'], null],
    [['month', '2025'], null],
    [[undefined, undefined], null],
  ] as const)('reads %j', ([scope, year], expected) => {
    expect(parseWrappedScope(scope as never, year as never)).toEqual(expected);
  });

  it('round-trips through the route params', () => {
    for (const s of [{ kind: 'year', year: 2025 }, { kind: 'all' }] as const) {
      const p = wrappedParams(s);
      expect(parseWrappedScope(p.scope, p.year)).toEqual(s);
    }
  });
});

describe('stepSlide', () => {
  it('holds at both ends', () => {
    expect(stepSlide(0, 5, -1)).toBe(0);
    expect(stepSlide(2, 5, 1)).toBe(3);
    expect(stepSlide(4, 5, 1)).toBe(4);
    expect(stepSlide(0, 1, 1)).toBe(0);
  });
});
