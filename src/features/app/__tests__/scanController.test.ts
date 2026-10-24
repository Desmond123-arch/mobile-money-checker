import { getImportState, resetImportState } from '@/backup/importStore';
import { setup } from '@/data/__tests__/fixtures';
import { HOUR, T0, paymentFor } from '@/ledger/__tests__/synthetic';
import { FakeMomoSms } from '@/scan/__tests__/fakeMomoSms';

import { createScanController } from '../scanController';

const pay = (androidId: number, txn: string) => ({
  androidId,
  body: paymentFor(txn, '5.00', 'MTNBUNDLE'),
  receivedAt: T0 + androidId * HOUR,
});

async function fixture() {
  resetImportState();
  const db = await setup();
  const sms = new FakeMomoSms();
  const onChanged = jest.fn();
  return { db, sms, onChanged, controller: createScanController({ db, sms, onChanged }) };
}

describe('scan controller', () => {
  it('reports the first scan through the import store and ends with a summary', async () => {
    const { sms, controller } = await fixture();
    sms.add(pay(1, '90000000001'), pay(2, '90000000002'));

    const pending = controller.scanFirst();
    expect(getImportState()).toMatchObject({ phase: 'running', kind: 'scan' });
    await pending;

    expect(getImportState()).toMatchObject({
      phase: 'done',
      kind: 'scan',
      read: 2,
      total: 2,
      empty: false,
      summary: { transactions: 2, payments: 2 },
    });
  });

  it('marks a granted permission with an empty inbox as done and empty', async () => {
    const { controller } = await fixture();

    await controller.scanFirst();

    expect(getImportState()).toMatchObject({ phase: 'done', empty: true, summary: null });
  });

  it('marks the import failed when the scan fails', async () => {
    const { sms, controller } = await fixture();
    sms.add(pay(1, '90000000001'));
    sms.failReadOn = 1;

    await controller.scanFirst();

    expect(getImportState().phase).toBe('failed');
  });

  it('turns a trigger into the announced first scan until the first import is done', async () => {
    const { sms, controller } = await fixture();
    sms.add(pay(1, '90000000001'));

    await controller.scan();

    expect(getImportState()).toMatchObject({ phase: 'done', kind: 'scan' });
  });

  it('leaves the import store alone when there is no access before the first import', async () => {
    const { sms, controller } = await fixture();
    sms.permission = 'denied';

    expect(await controller.scan()).toEqual({ status: 'no_permission', permission: 'denied' });

    expect(getImportState().phase).toBe('idle');
  });

  it('is silent after the first import and refreshes queries only when data changed', async () => {
    const { sms, controller, onChanged } = await fixture();
    sms.add(pay(1, '90000000001'));
    await controller.scanFirst();
    resetImportState();

    await controller.scan();
    expect(onChanged).not.toHaveBeenCalled();

    sms.add(pay(2, '90000000002'));
    await controller.scan();

    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(getImportState().phase).toBe('idle');
  });
});
