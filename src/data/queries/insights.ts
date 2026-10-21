import type { Db } from '../db';
import { addMonths, countWeekdays, dayRange, monthRange } from '@/domain/calendar/month';
import type { CategorySpend } from '@/domain/category/share';
import { pesewas, type Pesewas } from '@/domain/money';
import { noMonth, type MonthFlow } from '@/domain/summary/trend';

import { categorySpend } from './categories';
import { inRange, UI_CATEGORY_ID_SQL } from './sql';

/** Money out and in for the `count` months ending at `endMonthId`, oldest first; months with no data are zero. */
export async function monthlyFlows(db: Db, endMonthId: string, count = 6): Promise<MonthFlow[]> {
  const ids = Array.from({ length: count }, (_, i) => addMonths(endMonthId, i - count + 1));
  const time = inRange('at', { start: monthRange(ids[0]!).start, end: monthRange(endMonthId).end });
  const rows = await db.all<{ month: string; spent: number; money_in: number }>(
    `SELECT strftime('%Y-%m', at / 1000, 'unixepoch') AS month,
            COALESCE(SUM(CASE WHEN bucket = 'spend' THEN pesewas END), 0) AS spent,
            COALESCE(SUM(CASE WHEN bucket = 'income' THEN pesewas END), 0) AS money_in
     FROM ledger_lines WHERE ${time.sql} GROUP BY month`,
    time.params,
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return ids.map((monthId) => {
    const r = byMonth.get(monthId);
    return r ? { monthId, out: pesewas(r.spent), in: pesewas(r.money_in) } : noMonth(monthId);
  });
}

export interface SpendBreakdown {
  total: Pesewas;
  spend: CategorySpend[];
}

/** What was spent on one UTC day (`YYYY-MM-DD`), by category. */
export async function daySpend(db: Db, iso: string): Promise<SpendBreakdown> {
  const range = dayRange(iso);
  const time = inRange('at', range);
  const row = await db.get<{ s: number | null }>(
    `SELECT SUM(pesewas) AS s FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql}`,
    time.params,
  );
  return { total: pesewas(row?.s ?? 0), spend: await categorySpend(db, range) };
}

/**
 * What an average day of this weekday (0 = Sunday) looks like: spend on that weekday divided by
 * how many of that weekday fall between the first and the last day with spend. For a day that
 * has not happened yet.
 */
export async function weekdayAverage(db: Db, weekday: number): Promise<SpendBreakdown> {
  const span = await db.get<{ first: number | null; last: number | null }>(
    `SELECT MIN(at) AS first, MAX(at) AS last FROM ledger_lines WHERE bucket = 'spend'`,
  );
  if (span?.first == null || span.last == null) return { total: pesewas(0), spend: [] };
  const days = countWeekdays(span.first, span.last, weekday);
  if (days === 0) return { total: pesewas(0), spend: [] };
  const rows = await db.all<{ category_id: string; amount: number }>(
    `SELECT ${UI_CATEGORY_ID_SQL} AS category_id, SUM(l.pesewas) AS amount
     FROM ledger_lines l JOIN categories c ON c.id = l.category_id
     WHERE l.bucket = 'spend' AND CAST(strftime('%w', l.at / 1000, 'unixepoch') AS INTEGER) = ?
     GROUP BY c.id HAVING SUM(l.pesewas) > 0 ORDER BY amount DESC, c.sort_order`,
    [weekday],
  );
  const spend = rows.map((r) => ({
    categoryId: r.category_id,
    amount: pesewas(Math.round(r.amount / days)),
  }));
  return { total: pesewas(spend.reduce((sum, s) => sum + s.amount, 0)), spend };
}
