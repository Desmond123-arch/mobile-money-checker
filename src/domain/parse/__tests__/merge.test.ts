import { mergeAll } from '../merge';
import type { ParsedFragment } from '../types';
import { fragment, p, RECEIVED_AT } from './helpers';

const T = RECEIVED_AT;

function permutations<X>(items: X[]): X[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

const named = fragment({
  androidId: 'a1',
  counterpartyName: 'Kiosk Test',
  fee: p(5),
  tax: null,
  reference: 'bread',
  template: { name: 'payment_made', version: 1 },
});
const coded = fragment({
  androidId: 'a2',
  receivedAt: T + 1000,
  counterpartyName: null,
  merchantCode: '033097',
  fee: p(5),
  tax: p(2),
  balanceAfter: p(8000),
  reference: '-',
  occurredAt: { at: T - 5000, source: 'body' },
  template: { name: 'merchant_paid', version: 1 },
});
const wrongTime = fragment({
  androidId: 'a3',
  receivedAt: T + 2000,
  counterpartyName: 'Kiosk Test 0200000000',
  occurredAt: { at: T - 9000, source: 'body' },
});

describe('mergeAll', () => {
  it('applies per-field precedence', () => {
    expect(mergeAll([named, coded])).toEqual({
      momoTxnId: '90000000001',
      kind: 'payment_out',
      direction: 'out',
      amount: p(2500),
      fee: p(5),
      tax: p(2),
      balanceAfter: p(8000),
      counterpartyName: 'Kiosk Test',
      merchantCode: '033097',
      counterpartyNumber: null,
      reference: 'bread',
      occurredAt: { at: T - 5000, source: 'body' },
      hasConflict: false,
    });
  });

  it('keeps a tax of zero distinct from an absent tax', () => {
    const says = fragment({ androidId: 'b', tax: p(0), receivedAt: T + 1 });
    const silent = fragment({ androidId: 'a', tax: null });
    expect(mergeAll([silent, says]).tax).toBe(0);
    expect(mergeAll([silent]).tax).toBeNull();
  });

  it('prefers a name without digits over one with digits, whatever the arrival order', () => {
    expect(mergeAll([wrongTime, named]).counterpartyName).toBe('Kiosk Test');
    expect(mergeAll([wrongTime]).counterpartyName).toBe('Kiosk Test 0200000000');
  });

  it('prefers a real reference over a junk one and over none', () => {
    const none = fragment({ androidId: 'c', reference: null });
    expect(mergeAll([coded, named, none]).reference).toBe('bread');
    expect(mergeAll([coded, none]).reference).toBe('-');
    expect(mergeAll([none]).reference).toBeNull();
  });

  it('takes the earliest time among equals, and a body time over a received time', () => {
    const later = fragment({ androidId: 'd', occurredAt: { at: T + 50, source: 'body' } });
    const earlier = fragment({ androidId: 'e', occurredAt: { at: T + 10, source: 'body' } });
    expect(mergeAll([later, earlier, named]).occurredAt).toEqual({ at: T + 10, source: 'body' });
    expect(mergeAll([named, named]).occurredAt).toEqual({ at: T, source: 'received' });
  });

  it('flags a conflict on amount or kind and keeps the first by arrival', () => {
    const otherAmount = fragment({ androidId: 'f', receivedAt: T + 5, amount: p(999) });
    const otherKind = fragment({
      androidId: 'g',
      receivedAt: T + 6,
      kind: 'cash_out',
    });
    const merged = mergeAll([otherAmount, named]);
    expect(merged.hasConflict).toBe(true);
    expect(merged.amount).toBe(2500);
    expect(mergeAll([named, otherKind]).hasConflict).toBe(true);
    expect(mergeAll([named, coded]).hasConflict).toBe(false);
  });

  it('is commutative over every ordering', () => {
    const results = permutations([named, coded, wrongTime]).map((order) => mergeAll(order));
    for (const result of results) expect(result).toEqual(results[0]);
  });

  it('breaks arrival ties by android id and template so equal timestamps still agree', () => {
    const x: ParsedFragment = fragment({ androidId: 'same', counterpartyNumber: '1' });
    const y: ParsedFragment = fragment({
      androidId: 'same',
      counterpartyNumber: '2',
      template: { name: 'cash_out', version: 1 },
    });
    expect(mergeAll([x, y])).toEqual(mergeAll([y, x]));
  });

  it('refuses an empty list', () => {
    expect(() => mergeAll([])).toThrow(RangeError);
  });
});
