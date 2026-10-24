import { reconcileBalances, type BalanceRow } from '../reconcile';
import { p } from './helpers';

const out = (amount: number, balanceAfter: number | null, fee = 0, tax = 0): BalanceRow => ({
  kind: 'payment_out',
  amount: p(amount),
  fee: p(fee),
  tax: p(tax),
  balanceAfter: balanceAfter === null ? null : p(balanceAfter),
});

describe('reconcileBalances', () => {
  it('classifies each outgoing row against the previous balance', () => {
    const rows: BalanceRow[] = [
      out(100, 10000),
      out(250, 9750),
      out(1000, 8715, 25, 10),
      { kind: 'payment_in', amount: p(500), fee: null, tax: null, balanceAfter: p(9215) },
      out(200, 9015),
      out(300, 5000),
    ];
    expect(reconcileBalances(rows)).toEqual({
      amountOnly: 2,
      withCharges: 1,
      mismatch: 1,
      total: 4,
    });
  });

  it('treats unreported fee and tax as zero', () => {
    const rows: BalanceRow[] = [
      out(0, 1000),
      { kind: 'cash_out', amount: p(100), fee: null, tax: null, balanceAfter: p(900) },
    ];
    expect(reconcileBalances(rows).amountOnly).toBe(1);
  });

  it('skips rows without a balance and has nothing to compare for the first row', () => {
    const rows: BalanceRow[] = [out(100, null), out(100, 5000), out(100, null), out(100, 4900)];
    expect(reconcileBalances(rows)).toEqual({
      amountOnly: 1,
      withCharges: 0,
      mismatch: 0,
      total: 1,
    });
    expect(reconcileBalances([])).toEqual({ amountOnly: 0, withCharges: 0, mismatch: 0, total: 0 });
  });
});
