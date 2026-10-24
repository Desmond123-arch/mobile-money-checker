import { REVERSAL_WINDOW_MS, linkReversals, normalizeName, type ProjectedTxn } from '../reversal';
import { p } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const T = Date.UTC(2024, 5, 1);

function txn(overrides: Partial<ProjectedTxn> & { momoTxnId: string }): ProjectedTxn {
  return {
    kind: 'payment_out',
    amount: p(300),
    counterpartyName: 'MTN BUNDLE',
    occurredAt: T,
    ...overrides,
  };
}

describe('normalizeName', () => {
  it.each([
    ['MTN BUNDLE', 'mtnbundle'],
    ['MTNBUNDLE', 'mtnbundle'],
    ['Other Networks (one4all.sp)', 'othernetworks'],
    ['MTNBUNDLE . (cis)', 'mtnbundle'],
    ['Just4U', 'justu'],
    [null, ''],
  ])('normalises %j', (name, expected) => {
    expect(normalizeName(name)).toBe(expected);
  });
});

describe('linkReversals', () => {
  it('links a refund to the earlier payment whose name differs only in spacing and suffix', () => {
    const links = linkReversals([
      txn({ momoTxnId: 'pay', counterpartyName: 'MTNBUNDLE' }),
      txn({
        momoTxnId: 'ref',
        kind: 'refund',
        counterpartyName: 'MTN BUNDLE . (cis)',
        occurredAt: T + DAY,
      }),
    ]);
    expect(links).toEqual([{ reversalTxnId: 'ref', originalTxnId: 'pay', ambiguous: false }]);
  });

  it('links when one name is a prefix of the other', () => {
    const links = linkReversals([
      txn({ momoTxnId: 'pay', counterpartyName: 'Other Networks (one4all.sp)' }),
      txn({
        momoTxnId: 'rev',
        kind: 'reversal',
        counterpartyName: 'Other Networks',
        occurredAt: T + DAY,
      }),
    ]);
    expect(links).toHaveLength(1);
  });

  it('picks the closest earlier payment and flags the choice as ambiguous', () => {
    const links = linkReversals([
      txn({ momoTxnId: 'old', occurredAt: T }),
      txn({ momoTxnId: 'near', occurredAt: T + 5 * DAY }),
      txn({ momoTxnId: 'rev', kind: 'reversal', occurredAt: T + 6 * DAY }),
    ]);
    expect(links).toEqual([{ reversalTxnId: 'rev', originalTxnId: 'near', ambiguous: true }]);
  });

  it.each([
    ['a different amount', { amount: p(301) }],
    ['a different counterparty', { counterpartyName: 'Paystack' }],
    ['no counterparty', { counterpartyName: null }],
    ['an incoming row', { kind: 'payment_in' as const }],
    ['a payment later than the reversal', { occurredAt: T + 2 * DAY }],
    ['a payment older than 30 days', { occurredAt: T - REVERSAL_WINDOW_MS - 1 }],
  ])('does not link across %s', (_label, change) => {
    const links = linkReversals([
      txn({ momoTxnId: 'pay', ...change }),
      txn({ momoTxnId: 'rev', kind: 'reversal', occurredAt: T + DAY }),
    ]);
    expect(links).toEqual([]);
  });

  it('links on the 30-day boundary', () => {
    const links = linkReversals([
      txn({ momoTxnId: 'pay', occurredAt: T }),
      txn({ momoTxnId: 'rev', kind: 'reversal', occurredAt: T + REVERSAL_WINDOW_MS }),
    ]);
    expect(links).toHaveLength(1);
  });

  it('uses each payment once, in credit order, so two credits take two payments', () => {
    const links = linkReversals([
      txn({ momoTxnId: 'p1', occurredAt: T }),
      txn({ momoTxnId: 'p2', occurredAt: T + DAY }),
      txn({ momoTxnId: 'r1', kind: 'refund', occurredAt: T + 2 * DAY }),
      txn({ momoTxnId: 'r2', kind: 'reversal', occurredAt: T + 3 * DAY }),
    ]);
    expect(links).toEqual([
      { reversalTxnId: 'r1', originalTxnId: 'p2', ambiguous: true },
      { reversalTxnId: 'r2', originalTxnId: 'p1', ambiguous: false },
    ]);
  });

  it("skips credits and originals that already have a link, including the user's", () => {
    const txns = [
      txn({ momoTxnId: 'p1', occurredAt: T }),
      txn({ momoTxnId: 'p2', occurredAt: T + DAY }),
      txn({ momoTxnId: 'r1', kind: 'refund', occurredAt: T + 2 * DAY }),
      txn({ momoTxnId: 'r2', kind: 'refund', occurredAt: T + 3 * DAY }),
    ];
    const existing = [{ reversalTxnId: 'r1', originalTxnId: 'p2', ambiguous: false }];
    expect(linkReversals(txns, existing)).toEqual([
      { reversalTxnId: 'r2', originalTxnId: 'p1', ambiguous: false },
    ]);
  });

  it('is stable for equal timestamps by breaking ties on id', () => {
    const txns = [
      txn({ momoTxnId: 'b', occurredAt: T }),
      txn({ momoTxnId: 'a', occurredAt: T }),
      txn({ momoTxnId: 'rev', kind: 'reversal', occurredAt: T + DAY }),
    ];
    expect(linkReversals(txns)).toEqual(linkReversals([...txns].reverse()));
    expect(linkReversals(txns)[0]?.originalTxnId).toBe('a');
  });

  it('returns nothing when there are no credits', () => {
    expect(linkReversals([txn({ momoTxnId: 'pay' })])).toEqual([]);
  });
});
