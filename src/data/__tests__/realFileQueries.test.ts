import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';

import { readBackupMessages } from '@/backup/readBackup';
import { dayRange, monthRange } from '@/domain/calendar/month';
import { ALL_TIME, yearRange } from '@/domain/calendar/year';
import { spanLabel } from '@/domain/summary/year';
import { buildWrapped, type WrappedSlide } from '@/domain/summary/wrapped';
import { finishImport } from '@/ledger/finishImport';
import { ingest } from '@/ledger/ingest';

import {
  allTimeSummary,
  yearSummary,
  yearsWithData,
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
  topCounterparties,
  wrappedFacts,
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

    const years = await yearsWithData(db);
    const allTime = await allTimeSummary(db);
    for (const y of years) {
      const inYear = months.filter((m) => m.monthId.startsWith(String(y.year)));
      expect(y.out).toBe(inYear.reduce((a, m) => a + m.spent, 0));
      expect(y.in).toBe(inYear.reduce((a, m) => a + m.moneyIn, 0));
      const s = await yearSummary(db, y.year);
      expect(s.spent).toBe(y.out);
      expect(s.moneyIn).toBe(y.in);
      expect(s.payments).toBe(await paymentCount(db, yearRange(y.year)));
      const byCategory = await categorySpend(db, yearRange(y.year));
      expect(byCategory.reduce((a, c) => a + c.amount, 0)).toBe(y.out);
    }
    expect(allTime.spent).toBe(years.reduce((a, y) => a + y.out, 0));
    expect(allTime.moneyIn).toBe(years.reduce((a, y) => a + y.in, 0));
    expect(allTime.payments).toBe(
      (await Promise.all(years.map((y) => paymentCount(db, yearRange(y.year))))).reduce(
        (a, n) => a + n,
        0,
      ),
    );
    expect(allTime.firstMonthId).toBe(months[0]!.monthId);
    expect(allTime.lastMonthId).toBe(latest.monthId);
    const everything = await categorySpend(db, ALL_TIME);
    expect(everything.reduce((a, c) => a + c.amount, 0)).toBe(allTime.spent);

    expect(years.find((y) => y.year === 2025)?.out).toBe(3_065_554);
    expect(allTime.spent).toBe(5_671_551);
    expect(spanLabel(allTime.firstMonthId!, allTime.lastMonthId!)).toBe('Apr 2024 to Jun 2026');
    for (const scope of [{ kind: 'year', year: 2025 }, { kind: 'all' }] as const) {
      const facts = await wrappedFacts(db, scope);
      const range = scope.kind === 'year' ? yearRange(2025) : ALL_TIME;
      const slides = buildWrapped(facts);
      const find = <K extends WrappedSlide['kind']>(kind: K) =>
        slides.find((s): s is Extract<WrappedSlide, { kind: K }> => s.kind === kind);
      const insights = scope.kind === 'year' ? await yearSummary(db, 2025) : allTime;
      expect(find('total')?.big.amount).toBe(insights.spent);
      expect(facts.payments).toBe(insights.payments);
      expect(facts.weekdays.reduce((a, d) => a + d, 0)).toBe(insights.spent);
      expect(facts.categories.reduce((a, c) => a + c.amount, 0)).toBe(insights.spent);
      expect(facts.months.reduce((a, m) => a + m.out, 0)).toBe(insights.spent);
      const bySpend = await topCounterparties(db, range, 5, 'spent');
      const byCount = await topCounterparties(db, range, 5, 'count');
      expect(bySpend.reduce((a, c) => a + c.spent, 0)).toBeLessThanOrEqual(insights.spent);
      expect(byCount.reduce((a, c) => a + c.spent, 0)).toBeLessThanOrEqual(insights.spent);
      expect(facts.topBySpend?.spent).toBeLessThanOrEqual(insights.spent);
      expect(facts.biggest?.amount).toBeLessThanOrEqual(insights.spent);
      expect(facts.days.active).toBeLessThanOrEqual(facts.days.span);
      expect(slides.map((s) => s.line).join(' ')).not.toMatch(/Merchant|\b\d{6,}\b/);
      expect(find('person')?.line).toBeDefined();
      expect(find('busiest')?.big.text).toBe(scope.kind === 'year' ? 'November' : '2025');
      process.stdout.write(
        `\nwrapped ${scope.kind}: slides=${slides.map((s) => s.kind).join(',')}` +
          ` out=${ghs(facts.spent)} in=${ghs(facts.moneyIn)} payments=${facts.payments}` +
          ` topCategory=${find('category')?.big.value}% biggest=${ghs(facts.biggest?.amount ?? 0)}` +
          ` topBySpend=${ghs(facts.topBySpend?.spent ?? 0)}x${facts.topBySpend?.count}` +
          ` topByCount=${facts.topByCount?.count}x(${ghs(facts.topByCount?.spent ?? 0)})` +
          ` perDay=${ghs(find('daily')?.big.amount ?? 0)} span=${facts.days.span}` +
          ` active=${facts.days.active} quiet=${facts.days.span - facts.days.active}` +
          ` weekdaySun0=${facts.weekdays.map(ghs).join('/')}\n`,
      );
    }

    process.stdout.write(
      `\nreal export years\n` +
        years.map((y) => `${y.year} out=${ghs(y.out)} in=${ghs(y.in)}`).join('\n') +
        `\nall time ${spanLabel(allTime.firstMonthId!, allTime.lastMonthId!)}: out=${ghs(allTime.spent)}` +
        ` in=${ghs(allTime.moneyIn)} payments=${allTime.payments}` +
        ` busiestYear=${allTime.busiestYear?.year} busiestMonth=${allTime.busiestMonth?.monthId}\n`,
    );
    process.stdout.write(
      `\nreal export read queries\n` +
        months.map((m) => `${m.monthId} spent=${ghs(m.spent)} in=${ghs(m.moneyIn)}`).join('\n') +
        `\nlatest ${latest.monthId}: payments=${summary.payments} transactions=${list.length}` +
        ` biggest=${summary.peakLabel} delta=${summary.deltaLabel} ${summary.deltaCompare}\n` +
        `categories: ${spend.map((s) => `${s.categoryId}=${ghs(s.amount)}`).join(' ')}\n`,
    );
  }, 120_000);
});
