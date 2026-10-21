import { setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { HOUR, T0, paymentFor } from '@/ledger/__tests__/synthetic';

import { createScanner } from '../scan';
import { FakeMomoSms } from './fakeMomoSms';

// Fails the fragment insert of one transaction id, as a bad row would in production.
function failingOn(db: Db, needle: string): Db {
  const wrap = (inner: Db): Db => ({
    ...inner,
    run: (sql, params = []) =>
      sql.includes('INSERT INTO sms_fragments') && params.includes(needle)
        ? Promise.reject(new Error('constraint'))
        : inner.run(sql, params),
    transaction: (fn) => inner.transaction((tx) => fn(wrap(tx))),
  });
  return wrap(db);
}

describe('scan with a message the ledger cannot store', () => {
  it('records it as an error row, keeps the others, and does not re-read it', async () => {
    const real = await setup();
    const sms = new FakeMomoSms();
    sms.add(
      { androidId: 1, body: paymentFor('90000000001', '5.00', 'MTNBUNDLE'), receivedAt: T0 },
      { androidId: 2, body: paymentFor('90000000002', '6.00', 'MTNBUNDLE'), receivedAt: T0 + HOUR },
    );
    const scanner = createScanner({ db: failingOn(real, '90000000001'), sms });

    expect(await scanner.scan()).toMatchObject({ status: 'ok', read: 2, payments: 1 });

    const rows = await real.all<{ android_sms_id: number; status: string; reason: string | null }>(
      'SELECT android_sms_id, status, reason FROM sms_messages ORDER BY android_sms_id',
    );
    expect(rows).toEqual([
      { android_sms_id: 1, status: 'error', reason: 'error:ingest' },
      { android_sms_id: 2, status: 'parsed', reason: null },
    ]);
    const unread = await real.all('SELECT android_sms_id FROM unread_messages');
    expect(unread).toEqual([{ android_sms_id: 1 }]);

    sms.readCalls.length = 0;
    await scanner.scan();
    expect(sms.readCalls).toEqual([]);
  });
});
