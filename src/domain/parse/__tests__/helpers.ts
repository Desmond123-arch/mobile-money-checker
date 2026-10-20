import type { Pesewas } from '../../money';
import type { ParsedFragment, RawSms } from '../types';

export const RECEIVED_AT = Date.UTC(2024, 5, 1, 12, 0, 0);

export function sms(body: string, overrides: Partial<RawSms> = {}): RawSms {
  return { androidId: 'a1', sender: 'MobileMoney', body, receivedAt: RECEIVED_AT, ...overrides };
}

/** A full fragment with every field defaulted, so a test states only what differs. */
export function fragment(overrides: Partial<ParsedFragment> = {}): ParsedFragment {
  return {
    momoTxnId: '90000000001',
    kind: 'payment_out',
    direction: 'out',
    amount: 2500 as Pesewas,
    fee: null,
    tax: null,
    balanceAfter: null,
    counterpartyName: null,
    merchantCode: null,
    counterpartyNumber: null,
    reference: null,
    occurredAt: { at: RECEIVED_AT, source: 'received' },
    receivedAt: RECEIVED_AT,
    androidId: 'a1',
    template: { name: 'payment_made', version: 1 },
    ...overrides,
  };
}

export const p = (value: number) => value as Pesewas;
