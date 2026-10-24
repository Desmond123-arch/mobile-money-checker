import { buildLimits, limitsLeftCaption, resolveTotal, rowsFromSuggestion } from '../planLimits';

const entry = {
  mode: 'total' as const,
  totalText: '1000',
  dailyText: '50',
  startDay: '2026-11-01',
  endDay: '2026-11-30',
};

describe('resolveTotal', () => {
  it('reads the typed total', () => {
    expect(resolveTotal(entry)).toBe(100_000);
    expect(resolveTotal({ ...entry, totalText: '' })).toBeNull();
    expect(resolveTotal({ ...entry, totalText: '0' })).toBeNull();
  });

  it('multiplies a daily amount by the days', () => {
    expect(resolveTotal({ ...entry, mode: 'daily' })).toBe(150_000);
    expect(resolveTotal({ ...entry, mode: 'daily', endDay: '2026-11-01' })).toBe(5_000);
    expect(resolveTotal({ ...entry, mode: 'daily', dailyText: 'x' })).toBeNull();
  });
});

describe('limitsLeftCaption', () => {
  const rows = [
    { categoryId: 'food', amountText: '250' },
    { categoryId: 'transport', amountText: '100' },
  ];

  it('says what is still unplanned', () => {
    expect(limitsLeftCaption(100_000, rows)).toBe('GHS 650.00 of GHS 1,000.00 still unplanned');
  });

  it('ignores blanks and hides without a total', () => {
    expect(limitsLeftCaption(100_000, [{ categoryId: 'food', amountText: '' }])).toBe(
      'GHS 1,000.00 of GHS 1,000.00 still unplanned',
    );
    expect(limitsLeftCaption(null, rows)).toBeNull();
  });

  it('flags limits above the total', () => {
    expect(limitsLeftCaption(30_000, rows)).toBe('GHS 50.00 more than the GHS 300.00 total');
  });
});

describe('rowsFromSuggestion', () => {
  const limits = [
    { categoryId: 'food', amount: 40_000 },
    { categoryId: 'transport', amount: 30_000 },
  ];

  it('keeps everything without a total', () => {
    expect(rowsFromSuggestion(limits, null)).toEqual([
      { categoryId: 'food', amountText: '400.00' },
      { categoryId: 'transport', amountText: '300.00' },
    ]);
  });

  it('fits to the total', () => {
    expect(rowsFromSuggestion(limits, 50_000)).toEqual([
      { categoryId: 'food', amountText: '400.00' },
    ]);
  });
});

describe('buildLimits', () => {
  const name = (id: string) => (id === 'food' ? 'Food' : id);

  it('parses every amount', () => {
    expect(buildLimits([{ categoryId: 'food', amountText: '250' }], 100_000, name)).toEqual({
      ok: true,
      limits: [{ categoryId: 'food', amount: 25_000 }],
    });
  });

  it('names the category with a blank or bad amount', () => {
    for (const amountText of ['', 'abc', '0']) {
      expect(buildLimits([{ categoryId: 'food', amountText }], 100_000, name)).toEqual({
        ok: false,
        message: 'Enter an amount for Food.',
      });
    }
  });

  it('refuses limits above the total and duplicates', () => {
    const over = buildLimits([{ categoryId: 'food', amountText: '2000' }], 100_000, name);
    expect(over.ok).toBe(false);
    const twice = buildLimits(
      [
        { categoryId: 'food', amountText: '1' },
        { categoryId: 'food', amountText: '2' },
      ],
      100_000,
      name,
    );
    expect(twice).toEqual({ ok: false, message: 'Each category can have one limit.' });
  });
});
