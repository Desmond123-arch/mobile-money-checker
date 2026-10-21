import type { Db } from '../db';
import { addMonths, daysInMonth, monthRange } from '@/domain/calendar/month';
import { pesewas, type Pesewas } from '@/domain/money';
import { buildMonthSummary, type MonthFacts, type MonthSummary } from '@/domain/summary/month';

import { cashOutPrompts, needsNoteCount } from './needsNote';
import { paymentCount } from './transactions';
import { inRange } from './sql';

const DAY_MS = 86_400_000;

async function spendIn(db: Db, start: number, end: number): Promise<Pesewas> {
  const time = inRange('at', { start, end });
  const row = await db.get<{ s: number | null }>(
    `SELECT SUM(pesewas) AS s FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql}`,
    time.params,
  );
  return pesewas(row?.s ?? 0);
}

/**
 * The numbers behind Home for one month. `todayIso` (`YYYY-MM-DD`, UTC) says how much of the
 * current month has happened; `now` is for snoozed notes.
 */
export async function monthFacts(
  db: Db,
  monthId: string,
  todayIso: string,
  now: number,
): Promise<MonthFacts> {
  const range = monthRange(monthId);
  const isCurrent = todayIso.slice(0, 7) === monthId;
  const elapsedDays = isCurrent ? Number(todayIso.slice(8, 10)) : daysInMonth(monthId);
  const time = inRange('at', range);

  const totals = await db.get<{ spent: number | null; money_in: number | null }>(
    `SELECT SUM(CASE WHEN bucket = 'spend' THEN pesewas END) AS spent,
            SUM(CASE WHEN bucket = 'income' THEN pesewas END) AS money_in
     FROM ledger_lines WHERE ${time.sql}`,
    time.params,
  );
  const days = await db.all<{ day: number; spent: number }>(
    `SELECT CAST(strftime('%d', at / 1000, 'unixepoch') AS INTEGER) AS day, SUM(pesewas) AS spent
     FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql} GROUP BY day`,
    time.params,
  );

  const previousId = addMonths(monthId, -1);
  const previousRange = monthRange(previousId);
  const previousTime = inRange('at', previousRange);
  const previousLines = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ledger_lines WHERE ${previousTime.sql}`,
    previousTime.params,
  );
  // A month in progress is compared with the same stretch of the month before, not all of it.
  const previousEnd = isCurrent
    ? Math.min(previousRange.end, previousRange.start + elapsedDays * DAY_MS)
    : previousRange.end;

  return {
    monthId,
    isCurrent,
    elapsedDays,
    spent: pesewas(totals?.spent ?? 0),
    moneyIn: pesewas(totals?.money_in ?? 0),
    payments: await paymentCount(db, range),
    needNote:
      (await needsNoteCount(db, range, now)) + (await cashOutPrompts(db, range, now)).length,
    spendByDay: new Map(days.map((d) => [d.day, pesewas(d.spent)])),
    previous:
      (previousLines?.n ?? 0) > 0
        ? { monthId: previousId, spent: await spendIn(db, previousRange.start, previousEnd) }
        : null,
  };
}

export async function monthSummary(
  db: Db,
  monthId: string,
  todayIso: string,
  now: number,
): Promise<MonthSummary> {
  return buildMonthSummary(await monthFacts(db, monthId, todayIso, now));
}
