import { pesewas } from '@/domain/money';

import { buildMonthOptions, defaultMonthId, monthIdOfIso, monthOption } from '../months';

const totals = (monthId: string, spent: number, moneyIn: number) => ({
  monthId,
  spent: pesewas(spent),
  moneyIn: pesewas(moneyIn),
});

describe('month options', () => {
  it('offers the months with data and always the current month', () => {
    const options = buildMonthOptions(
      [totals('2026-05', 100, 50), totals('2026-06', 200, 0)],
      '2026-10',
    );
    expect(options.map((o) => [o.id, o.isCurrent, o.spent])).toEqual([
      ['2026-05', false, 100],
      ['2026-06', false, 200],
      ['2026-10', true, 0],
    ]);
    expect(options[0]).toMatchObject({ label: 'May 2026', short: 'May' });
  });

  it('does not duplicate the current month and sorts oldest first', () => {
    const options = buildMonthOptions(
      [totals('2026-10', 1, 1), totals('2026-02', 1, 1)],
      '2026-10',
    );
    expect(options.map((o) => o.id)).toEqual(['2026-02', '2026-10']);
    expect(options[1]?.isCurrent).toBe(true);
  });

  it('builds an option for a month the lists do not know', () => {
    expect(monthOption('2024-04', '2026-10')).toMatchObject({ short: 'Apr', spent: 0 });
    expect(monthIdOfIso('2026-10-20')).toBe('2026-10');
  });
});

describe('defaultMonthId', () => {
  it('stays on the current month when it has data or nothing does', () => {
    expect(defaultMonthId([], '2026-10')).toBe('2026-10');
    expect(defaultMonthId(['2026-06', '2026-10'], '2026-10')).toBe('2026-10');
  });

  it('falls back to the latest month with data when the current one is empty', () => {
    expect(defaultMonthId(['2026-05', '2026-06', '2024-04'], '2026-10')).toBe('2026-06');
  });
});
