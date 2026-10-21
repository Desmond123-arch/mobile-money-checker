import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';

import { readBackupMessages } from '@/backup/readBackup';
import { dayRange, monthRange } from '@/domain/calendar/month';
import { finishImport } from '@/ledger/finishImport';
import { ingest } from '@/ledger/ingest';

import {
  categorySpend,
  daySpend,
  listTransactions,
  monthlyFlows,
  monthSummary,
  monthsWithData,
  needsNoteCount,
  paymentCount,
  recentPayments,
  transactionDetail,
  weekdayAverage,
} from '../queries';
import { setup } from './fixtures';

const FILE = '/mnt/c/Users/Desmond Opoku Mends/Downloads/sms-20260621002856.xml';
const run = existsSync(FILE) ? describe : describe.skip;

// Optional: needs the user's private export. Prints numbers only, never message text.
run('read queries on the real export', () => {
  it('agree with each other for every month and the latest month', async () => {
    const db = await setup();
    const fd = openSync(FILE, 'r');
    const source = {
      size: statSync(FILE).size,
      read: async (offset: number, length: number) => {
        const buf = new Uint8Array(length);
        return buf.subarray(0, readSync(fd, buf, 0, length, offset));
      },
    };
    for await (const batch of readBackupMessages(source, { batchSize: 200 })) {
      await ingest(
        db,
        batch.map((m) => ({ source: 'backup' as const, body: m.body, receivedAt: m.receivedAt })),
      );
    }
    closeSync(fd);
    await finishImport(db);

    const months = await monthsWithData(db);
    expect(months.length).toBeGreaterThan(0);
    const latest = months[months.length - 1]!;
    const range = monthRange(latest.monthId);
    const today = new Date('2026-06-21T12:00:00Z');
    const now = today.getTime();

    const summary = await monthSummary(db, latest.monthId, '9999-12-31', now);
    expect(summary.spent).toBe(latest.spent);
    expect(summary.moneyIn).toBe(latest.moneyIn);
    expect(summary.daily.reduce((a, b) => a + b, 0)).toBe(latest.spent);
    expect(summary.payments).toBe(await paymentCount(db, range));
    // A backup is older than its own import, so no payment is asked about.
    expect(summary.needNote).toBe(0);
    expect(await needsNoteCount(db, null, now)).toBe(0);

    const spend = await categorySpend(db, range);
    expect(spend.reduce((a, s) => a + s.amount, 0)).toBe(latest.spent);

    const flows = await monthlyFlows(db, latest.monthId);
    expect(flows[5]).toMatchObject({ out: latest.spent, in: latest.moneyIn });

    const list = await listTransactions(db, { range });
    const outgoing = await listTransactions(db, { range, direction: 'out' });
    expect(outgoing).toHaveLength(summary.payments);
    expect(list.length).toBeGreaterThanOrEqual(outgoing.length);

    const recent = await recentPayments(db, range, 3);
    expect(recent).toHaveLength(3);
    const detail = await transactionDetail(db, Number(recent[0]!.row.id), today);
    expect(detail?.amount).toBe(recent[0]!.row.amount);

    const peak = summary.daily.indexOf(Math.max(...summary.daily) as never) + 1;
    const peakIso = `${latest.monthId}-${String(peak).padStart(2, '0')}`;
    expect((await daySpend(db, peakIso)).total).toBe(Math.max(...summary.daily));
    expect((await weekdayAverage(db, 1)).spend.length).toBeGreaterThan(0);
    expect(dayRange(peakIso).end - dayRange(peakIso).start).toBe(86_400_000);

    const ghs = (p: number) => (p / 100).toFixed(2);
    process.stdout.write(
      `\nreal export read queries\n` +
        months.map((m) => `${m.monthId} spent=${ghs(m.spent)} in=${ghs(m.moneyIn)}`).join('\n') +
        `\nlatest ${latest.monthId}: payments=${summary.payments} transactions=${list.length}` +
        ` biggest=${summary.peakLabel} delta=${summary.deltaLabel} ${summary.deltaCompare}\n` +
        `categories: ${spend.map((s) => `${s.categoryId}=${ghs(s.amount)}`).join(' ')}\n`,
    );
  }, 120_000);
});
