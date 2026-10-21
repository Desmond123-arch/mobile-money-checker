import { summaryLine } from '../summaryLine';

describe('summaryLine', () => {
  it('names counts, the latest month and its spend', () => {
    expect(
      summaryLine({
        transactions: 1640,
        payments: 1328,
        latestMonth: '2026-06',
        monthSpendPesewas: 192556,
      }),
    ).toBe('1,640 transactions, 1,328 payments. Spent in June 2026: GHS 1,925.56.');
  });

  it('omits the month when nothing was spent', () => {
    expect(
      summaryLine({ transactions: 2, payments: 0, latestMonth: null, monthSpendPesewas: 0 }),
    ).toBe('2 transactions, 0 payments.');
  });
});
