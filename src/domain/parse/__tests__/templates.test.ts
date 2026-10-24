import { parseSms } from '../parse';
import { TEMPLATES } from '../registry';
import type { ParsedFragment } from '../types';
import { p, RECEIVED_AT, sms } from './helpers';

const PROMO =
  ' Download the MoMo App for a Faster & Easier Experience Click here: http://example.test/app';
const at = (iso: string) => Date.parse(`${iso}Z`);

interface Case {
  name: string;
  body: string;
  expected: Partial<ParsedFragment>;
}

const cases: Case[] = [
  {
    name: 'payment_made, "Tax charged" layout with trailing promo',
    body: `Payment made for GHS 25.00 to Kofi Test Current Balance: GHS 100.50 . Available Balance: GHS 100.50. Reference: bread. Transaction ID: 90000000001. Fee charged: GHS0.00 Tax charged: 0.00.${PROMO}`,
    expected: {
      kind: 'payment_out',
      direction: 'out',
      amount: p(2500),
      fee: p(0),
      tax: p(0),
      balanceAfter: p(10050),
      counterpartyName: 'Kofi Test',
      reference: 'bread',
      template: { name: 'payment_made', version: 1 },
    },
  },
  {
    name: 'payment_made, "TAX charged: GHS" layout without promo, dot after the name, thousands in the balance',
    body: 'Payment made for GHS 250.00 to AMA TEST. Current Balance: GHS 1,100.50. Available Balance: GHS 1,100.50. Reference: rent. Transaction ID: 90000000002. Fee charged: GHS 0.75 TAX charged: GHS 0.13.',
    expected: {
      amount: p(25000),
      fee: p(75),
      tax: p(13),
      balanceAfter: p(110050),
      counterpartyName: 'AMA TEST',
      momoTxnId: '90000000002',
      reference: 'rent',
    },
  },
  {
    name: 'payment_made with an empty reference',
    body: 'Payment made for GHS 5.00 to AMA TEST Current Balance: GHS 10.00 . Available Balance: GHS 10.00. Reference: . Transaction ID: 90000000003. Fee charged: GHS0.00 Tax charged: 0.00.',
    expected: { amount: p(500), reference: null, momoTxnId: '90000000003' },
  },
  {
    name: 'payment_made keeps a "-" reference for the categoriser to treat as junk',
    body: 'Payment made for GHS 5.00 to AMA TEST Current Balance: GHS 10.00 . Available Balance: GHS 10.00. Reference: -. Transaction ID: 90000000003. Fee charged: GHS0.00 Tax charged: 0.00.',
    expected: { reference: '-' },
  },
  {
    name: 'payment_completed, reference after the balance, "Tax was GHS -"',
    body: `Your payment of GHS 3.00 to MTN AIRTIME has been completed at 2024-04-13 15:46:23. Your new balance: GHS 0.02. Fee was GHS 0.00 Tax was GHS -. Reference: -. Financial Transaction Id: 37270478586. External Transaction Id: 37270478586.${PROMO}`,
    expected: {
      momoTxnId: '37270478586',
      amount: p(300),
      fee: p(0),
      tax: p(0),
      balanceAfter: p(2),
      counterpartyName: 'MTN AIRTIME',
      reference: '-',
      occurredAt: { at: at('2024-04-13T15:46:23'), source: 'body' },
      template: { name: 'payment_completed', version: 1 },
    },
  },
  {
    name: 'payment_completed, reference before the balance, "Tax charged: GHS", name,number,note reference',
    body: 'Your payment of GHS 40.00 to ADA TEST has been completed at 2025-01-02 03:04:05. Reference: ADA TEST ,233200000123,lunch for two. Your new balance: GHS 90.00. Fee was GHS 0.60 Tax charged: GHS0.10. Financial Transaction Id: 90000000004. External Transaction Id: -.',
    expected: {
      momoTxnId: '90000000004',
      amount: p(4000),
      fee: p(60),
      tax: p(10),
      balanceAfter: p(9000),
      counterpartyName: 'ADA TEST',
      counterpartyNumber: '233200000123',
      reference: 'ADA TEST ,233200000123,lunch for two',
      occurredAt: { at: at('2025-01-02T03:04:05'), source: 'body' },
    },
  },
  {
    name: 'payment_completed, empty reference and a curly apostrophe elsewhere',
    body: 'Your payment of GHS 7.00 to  EKUA’S FOOD JOINT has been completed at 2025-01-02 03:04:05. Reference: . Your new balance: GHS 90.00. Fee was GHS 0.00 Tax charged: GHS0.00. Financial Transaction Id: 90000000005. External Transaction Id: -.',
    expected: { counterpartyName: "EKUA'S FOOD JOINT", reference: null, momoTxnId: '90000000005' },
  },
  {
    name: 'payment_for, double-dot layout',
    body: `Payment for GHS2.99 to MTNBUNDLE ..Current Balance: GHS 95.20. Transaction Id: 90000000006. Fee charged: GHS0.00,Tax Charged 0.${PROMO}`,
    expected: {
      momoTxnId: '90000000006',
      amount: p(299),
      fee: p(0),
      tax: p(0),
      balanceAfter: p(9520),
      counterpartyName: 'MTNBUNDLE',
      reference: null,
      template: { name: 'payment_for', version: 1 },
    },
  },
  {
    name: 'payment_for, name with a dot and digits',
    body: 'Payment for GHS10.00 to Just4U  .Current Balance: GHS 5.20. Transaction Id: 90000000007. Fee charged: GHS0.10,Tax Charged 0.02.',
    expected: { counterpartyName: 'Just4U', fee: p(10), tax: p(2), amount: p(1000) },
  },
  {
    name: 'merchant_paid keeps the merchant code out of the name and ignores the 12-digit value',
    body: `Y'ello. You have Paid GHS 10 to Merchant 033097 on your mobile money account at 202408131727. Message from sender: bread. Your new balance: GHS 867.09 . Fee was GHS 0.05 . Financial Transaction Id: 90000000008.${PROMO}`,
    expected: {
      momoTxnId: '90000000008',
      amount: p(1000),
      fee: p(5),
      tax: null,
      balanceAfter: p(86709),
      counterpartyName: null,
      merchantCode: '033097',
      reference: 'bread',
      occurredAt: { at: RECEIVED_AT, source: 'received' },
      template: { name: 'merchant_paid', version: 1 },
    },
  },
  {
    name: 'merchant_paid with a curly apostrophe and a named merchant',
    body: 'Y’ello. You have Paid GHS 12.50 to Kiosk Test on your MTN MoMo account at 202408131727. Message from sender: . Your new balance: GHS 1,000.00 . Fee was GHS 0.00 . Financial Transaction Id: 90000000009.',
    expected: {
      counterpartyName: 'Kiosk Test',
      merchantCode: null,
      reference: null,
      balanceAfter: p(100000),
    },
  },
  {
    name: 'cash_out',
    body: 'Cash Out made for GHS50.00 to AGENT TEST VENTURES. Current Balance: GHS752.59 Financial Transaction Id: 90000000010. Cash-out fee is charged automatically from your MTN MoMo wallet. Please do not pay any fees to the Agent. Thank you for using MTN MobileMoney. Fee charged: GHS0.50.',
    expected: {
      kind: 'cash_out',
      direction: 'out',
      momoTxnId: '90000000010',
      amount: p(5000),
      fee: p(50),
      tax: null,
      balanceAfter: p(75259),
      counterpartyName: 'AGENT TEST VENTURES',
      reference: null,
      template: { name: 'cash_out', version: 1 },
    },
  },
  {
    name: 'transfer_out',
    body: 'You have transferred 10.00 GHS to Other Networks   (one4all.sp) from your mobile money account 112000001 at 2025-04-25 10:00:29. Your new balance: 106.23 GHS. Message from sender: airtime:Telecel:0200000000:6. Message to receiver: . Financial Transaction Id: 90000000011.',
    expected: {
      kind: 'transfer_out',
      direction: 'out',
      momoTxnId: '90000000011',
      amount: p(1000),
      fee: null,
      tax: null,
      balanceAfter: p(10623),
      counterpartyName: 'Other Networks (one4all.sp)',
      reference: 'airtime:Telecel:0200000000:6',
      occurredAt: { at: at('2025-04-25T10:00:29'), source: 'body' },
      template: { name: 'transfer_out', version: 1 },
    },
  },
  {
    name: 'payment_received with a name,number,note reference',
    body: `Payment received for GHS 20.00 from KWESI TEST Current Balance: GHS 120.00 . Available Balance: GHS 120.00. Reference: KWESI TEST ,233200000456,back. Transaction ID: 90000000012. TRANSACTION FEE: 0.00`,
    expected: {
      kind: 'payment_in',
      direction: 'in',
      momoTxnId: '90000000012',
      amount: p(2000),
      fee: p(0),
      tax: null,
      balanceAfter: p(12000),
      counterpartyName: 'KWESI TEST',
      counterpartyNumber: '233200000456',
      reference: 'KWESI TEST ,233200000456,back',
      template: { name: 'payment_received', version: 1 },
    },
  },
  {
    name: 'payment_received from an empty name',
    body: 'Payment received for GHS 20.00 from  Current Balance: GHS 120.00 . Available Balance: GHS 120.00. Reference: 5. Transaction ID: 90000000013. TRANSACTION FEE: 0',
    expected: { counterpartyName: null, reference: '5' },
  },
  {
    name: 'cash_in',
    body: 'Cash In received for GHS 101.00 from SHOP TEST 88 VENTURES . Current Balance GHS 144.70 Available Balance GHS 144.70. Transaction ID: 90000000014. Fee charged: GHS 0. Cash in (Deposit) is a free transaction on MTN Mobile Money. Please do not pay any fees for it.',
    expected: {
      kind: 'cash_in',
      direction: 'in',
      momoTxnId: '90000000014',
      amount: p(10100),
      fee: p(0),
      balanceAfter: p(14470),
      counterpartyName: 'SHOP TEST 88 VENTURES',
      reference: null,
      template: { name: 'cash_in', version: 1 },
    },
  },
  {
    name: 'interest',
    body: 'An amount of GHS 7.93 has been credited to your mobile money account. Message:Interest for January to March 2024. Your new balance: GHS 8.07. Financial Transaction Id: 90000000015.',
    expected: {
      kind: 'interest',
      direction: 'in',
      momoTxnId: '90000000015',
      amount: p(793),
      fee: null,
      balanceAfter: p(807),
      counterpartyName: null,
      reference: 'Interest for January to March 2024',
      template: { name: 'interest', version: 1 },
    },
  },
  {
    name: 'refund, lowercase "transaction ID" absent and an External id of "-"',
    body: 'Hello, MTNBUNDLE . (cis) has successfully refunded GHS 3.00 to your mobile money account at 2024-06-23 03:29:35. Message from refunder: . Your new balance:394.89 GHS. Financial Transaction Id: 90000000016. External Transaction Id: -. TRANSACTION FEE IS 0',
    expected: {
      kind: 'refund',
      direction: 'in',
      momoTxnId: '90000000016',
      amount: p(300),
      fee: p(0),
      balanceAfter: p(39489),
      counterpartyName: 'MTNBUNDLE . (cis)',
      reference: null,
      occurredAt: { at: at('2024-06-23T03:29:35'), source: 'body' },
      template: { name: 'refund', version: 1 },
    },
  },
  {
    name: 'refund with a message',
    body: 'Hello, Other Networks (one4all.sp) has successfully refunded GHS 5.00 to your mobile money account at 2024-06-23 03:29:35. Message from refunder: Recharge failed payment reversed. Your new balance:10.00 GHS. Financial Transaction Id: 90000000017. External Transaction Id: -. TRANSACTION FEE IS 0',
    expected: {
      reference: 'Recharge failed payment reversed',
      counterpartyName: 'Other Networks (one4all.sp)',
    },
  },
  {
    name: 'reversal',
    body: "Y'ello Valued Customer, the transfer of GHS 3.00 to Just4u   has been reversed on 2024-05-29 11:42:21 with transaction ID: 90000000018. Your new balance is GHS3.40. Transaction fee is GHS0.",
    expected: {
      kind: 'reversal',
      direction: 'in',
      momoTxnId: '90000000018',
      amount: p(300),
      fee: p(0),
      tax: null,
      balanceAfter: p(340),
      counterpartyName: 'Just4u',
      occurredAt: { at: at('2024-05-29T11:42:21'), source: 'body' },
      template: { name: 'reversal', version: 1 },
    },
  },
  {
    name: 'reversal of a payment',
    body: "Y'ello Valued Customer, the payment of GHS 12.00 to AMA TEST has been reversed on 2024-05-29 11:42:21 with transaction ID: 90000000019. Your new balance is GHS3.40. Transaction fee is GHS0.",
    expected: { counterpartyName: 'AMA TEST', amount: p(1200) },
  },
];

describe('templates', () => {
  it.each(cases)('$name', ({ body, expected }) => {
    const result = parseSms(sms(body));
    expect(result).toMatchObject({ status: 'parsed', fragment: expected });
    expect(result).toMatchObject({ fragment: { androidId: 'a1', receivedAt: RECEIVED_AT } });
  });

  it('has a template for each shape and names are unique', () => {
    const names = TEMPLATES.map((template) => template.name);
    expect(new Set(names).size).toBe(11);
  });

  it.each([
    [
      'an amount that is not a plain amount',
      'Payment made for GHS 1.234 to X Current Balance: GHS 1.00. Transaction ID: 9.',
    ],
    [
      'no numeric transaction id',
      'Payment made for GHS 5.00 to X Current Balance: GHS 1.00. Transaction ID: pending.',
    ],
  ])('matches the head but is unparsed for %s', (_label, body) => {
    expect(parseSms(sms(body))).toEqual({ status: 'unparsed' });
  });
});
