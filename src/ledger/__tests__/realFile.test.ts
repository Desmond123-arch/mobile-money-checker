import { existsSync, closeSync, openSync, readSync, statSync } from 'node:fs';

import { setup } from '@/data/__tests__/fixtures';
import { readBackupMessages } from '@/backup/readBackup';
import { finishImport } from '../finishImport';
import { ingest } from '../ingest';

const FILE = '/mnt/c/Users/Desmond Opoku Mends/Downloads/sms-20260621002856.xml';
const run = existsSync(FILE) ? describe : describe.skip;

// Optional: needs the user's private export. Prints numbers only, never message text.
run('real export', () => {
  it('streams the file through reader, ingest and finishImport', async () => {
    const db = await setup();
    const fd = openSync(FILE, 'r');
    const source = {
      size: statSync(FILE).size,
      read: async (offset: number, length: number) => {
        const buf = new Uint8Array(length);
        const n = readSync(fd, buf, 0, length, offset);
        return buf.subarray(0, n);
      },
    };
    const totals = { parsed: 0, ignored: 0, unparsed: 0, errors: 0 };
    const payments = new Set<string>();
    for await (const batch of readBackupMessages(source, { batchSize: 200 })) {
      const r = await ingest(
        db,
        batch.map((m) => ({ source: 'backup' as const, body: m.body, receivedAt: m.receivedAt })),
      );
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
      r.paymentIds.forEach((id) => payments.add(id));
    }
    closeSync(fd);
    const { linked } = await finishImport(db);

    const txns = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
    const links = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM reversal_links');
    const months = await db.all<{ month: string; spend: number; income: number; fees: number }>(
      `SELECT strftime('%Y-%m', at / 1000, 'unixepoch') AS month,
         SUM(CASE WHEN bucket = 'spend' THEN pesewas ELSE 0 END) AS spend,
         SUM(CASE WHEN bucket = 'income' THEN pesewas ELSE 0 END) AS income,
         SUM(CASE WHEN part = 'charge' THEN pesewas ELSE 0 END) AS fees
       FROM ledger_lines GROUP BY month ORDER BY month`,
    );
    const ghs = (p: number) => (p / 100).toFixed(2);
    process.stdout.write(
      `\nreal export: ${JSON.stringify(totals)} transactions=${txns!.n} payments=${payments.size} links=${links!.n}\n` +
        months
          .map(
            (m) => `${m.month} spend=${ghs(m.spend)} income=${ghs(m.income)} fees=${ghs(m.fees)}`,
          )
          .join('\n') +
        '\n',
    );

    expect(totals).toMatchObject({ parsed: 1913, ignored: 575, errors: 0 });
    expect(txns!.n).toBe(1640);
    expect(links!.n).toBe(6);
    expect(linked).toBe(6);
  }, 120_000);
});
