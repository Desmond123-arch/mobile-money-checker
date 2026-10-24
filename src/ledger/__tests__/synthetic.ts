import type { Db } from '@/data/db';
import type { IngestItem } from '../ingest';

export const T0 = Date.UTC(2024, 5, 3, 9, 0, 0);
export const HOUR = 3_600_000;

export const paymentFor = (id: string, ghs: string, to: string, fee = '0.00') =>
  `Payment for GHS${ghs} to ${to} ..Current Balance: GHS 7,866.43. Transaction Id: ${id}. Fee charged: GHS${fee},Tax Charged 0.Download the MoMo App.`;

export const cashOut = (id: string, ghs: string, to: string) =>
  `Cash Out made for GHS${ghs} to ${to}. Current Balance: GHS8,523.82 Financial Transaction Id: ${id}. Cash-out fee is charged automatically from your MTN MoMo wallet. Please do not pay any fees to the Agent. Thank you for using MTN MobileMoney. Fee charged: GHS0.50.`;

export const received = (id: string, ghs: string, from: string) =>
  `Payment received for GHS ${ghs} from ${from}  Current Balance: GHS 7,871.24 . Available Balance: GHS 7,871.24. Reference: gift. Transaction ID: ${id}. TRANSACTION FEE: 0.00`;

export const reversed = (id: string, ghs: string, to: string) =>
  `Y'ello Valued Customer, the transfer of GHS ${ghs} to ${to} has been reversed on 2024-06-05 11:42:21 with transaction ID: ${id}. Your new balance is GHS7,774.63. Transaction fee is GHS0.`;

export const merchantPaid = (id: string, ghs: string, code: string) =>
  `Y'ello. You have Paid GHS ${ghs} to Merchant ${code} on your mobile money account at 202408131747. Message from sender: bread. Your new balance: GHS 8,638.32 . Fee was GHS 0.05 . Financial Transaction Id: ${id}.Download the MoMo App.`;

export const paymentCompleted = (id: string, ghs: string, to: string) =>
  `Your payment of GHS ${ghs} to ${to} has been completed at 2024-08-13 17:47:30. Your new balance: GHS 8,638.32. Fee was GHS 0.05 Tax was GHS -. Reference: bread. Financial Transaction Id: ${id}. External Transaction Id: ${id}.Download the MoMo App.`;

export const OTP = '<#> Your code is 123456';
export const PROMO = 'Hello, enjoy our new bundles this week.';
export const FAILED = `Your payment of GHS 30.00 to VODAFONE PUSH  has failed at 2024-06-08 17:17:11. Reference: bundle. Financial Transaction Id: 90009999999. External Transaction Id: -. TRANSACTION FEE IS 0`;
export const UNKNOWN = 'A brand new kind of message. Transaction ID: 90009999998.';

export const item = (
  body: string,
  receivedAt: number,
  source: IngestItem['source'] = 'backup',
): IngestItem =>
  source === 'backup'
    ? { source, body, receivedAt }
    : { source, body, receivedAt, androidId: receivedAt % 1_000_000 };

/** Spend by hand: 3.00 + (50.00 + 0.50) + (10.00 + 0.10) - 3.00 refunded = 60.60. */
export const BATCH: IngestItem[] = [
  item(paymentFor('90000000001', '3.00', 'MTNBUNDLE'), T0),
  item(cashOut('90000000002', '50.00', 'BALOMI VENTURES'), T0 + HOUR),
  item(paymentFor('90000000003', '10.00', 'Just4u', '0.10'), T0 + 2 * HOUR),
  item(received('90000000004', '100.00', 'Kofi Mensah'), T0 + 3 * HOUR),
  item(reversed('90000000005', '3.00', 'MTN BUNDLE'), T0 + 4 * HOUR),
  item(OTP, T0 + 5 * HOUR),
  item(PROMO, T0 + 6 * HOUR),
  item(FAILED, T0 + 7 * HOUR),
  item(UNKNOWN, T0 + 8 * HOUR),
];
export const HAND_SPEND = 6060;

export const dump = (db: Db) =>
  Promise.all([
    db.all('SELECT * FROM transactions ORDER BY momo_txn_id'),
    db.all('SELECT * FROM sms_messages ORDER BY backup_key, android_sms_id'),
    db.all(
      'SELECT f.* FROM sms_fragments f JOIN sms_messages m ON m.id = f.message_id ORDER BY m.backup_key, m.android_sms_id',
    ),
    db.all('SELECT * FROM reversal_links'),
  ]);
