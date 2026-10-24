import { setup } from '@/data/__tests__/fixtures';
import {
  BATCH,
  HAND_SPEND,
  merchantPaid,
  paymentCompleted,
  T0,
} from '@/ledger/__tests__/synthetic';
import { createLedgerSink } from '../ledgerSink';

const asBackup = (items: { body: string; receivedAt: number }[]) =>
  items.map((m) => ({ ...m, address: 'MobileMoney' }));

describe('ledger sink', () => {
  it('counts a payment split across batches once and summarises the ledger', async () => {
    const db = await setup();
    const sink = createLedgerSink(db);
    const a = { body: merchantPaid('90000000010', '10', '090000'), receivedAt: T0 };
    const b = {
      body: paymentCompleted('90000000010', '10.00', 'KESABA STORES'),
      receivedAt: T0 + 1,
    };
    expect(await sink.ingestBatch(asBackup([a]))).toEqual({ payments: 1 });
    expect(await sink.ingestBatch(asBackup([b]))).toEqual({ payments: 0 });
  });

  it('finish links reversals and returns the summary', async () => {
    const db = await setup();
    const sink = createLedgerSink(db);
    const r = await sink.ingestBatch(asBackup(BATCH));
    expect(r.payments).toBe(3);
    expect(await sink.finish()).toEqual({
      transactions: 5,
      payments: 3,
      latestMonth: '2024-06',
      monthSpendPesewas: HAND_SPEND,
    });
  });
});
