import type { Db } from '../db';
import type { TimeRange } from '@/domain/calendar/month';
import { ALL_TIME, yearRange } from '@/domain/calendar/year';
import { pesewas, type Pesewas } from '@/domain/money';
import { noMonth } from '@/domain/summary/trend';
import type {
  BiggestPayment,
  NamedSpend,
  WrappedFacts,
  WrappedScope,
} from '@/domain/summary/wrapped';

import { categorySpend, listCategories } from './categories';
import { inRange } from './sql';
import { allTimeSummary, yearSummary } from './years';
import { monthsWithData } from './months';

const DAY_MS = 86_400_000;

/**
 * One row per outgoing transaction with its net spend in the range: amount plus fees and tax,
 * minus what was refunded. A refund carries its original's time, so it nets in the same range.
 * `net_amount` leaves fees out, for "the biggest payment". Retracted rows are not in the ledger.
 */
const netPerTransaction = (range: TimeRange) => {
  const time = inRange('at', range);
  return {
    sql: `SELECT transaction_id AS id, SUM(pesewas) AS net_all,
                 SUM(CASE WHEN part IN ('amount','credit') THEN pesewas END) AS net_amount
          FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql} GROUP BY transaction_id`,
    params: time.params,
  };
};

const NAMED = `NULLIF(TRIM(t.counterparty_name), '')`;

/**
 * The people and places paid most, money out only. Grouped by name ignoring case, so a raw
 * merchant code or number never stands in for a name. Rows with no name, payments to yourself
 * and typed-in expenses (whose "name" is what you called them) are left out. Ordered by net
 * spend or by number of payments; the other measure breaks ties, then the name.
 */
export async function topCounterparties(
  db: Db,
  range: TimeRange,
  n: number,
  by: 'spent' | 'count' = 'spent',
): Promise<NamedSpend[]> {
  const net = netPerTransaction(range);
  const order = by === 'spent' ? 'spent DESC, count DESC, name' : 'count DESC, spent DESC, name';
  const rows = await db.all<{ name: string; spent: number; count: number }>(
    `SELECT MIN(${NAMED}) AS name, SUM(net.net_all) AS spent, COUNT(*) AS count
     FROM (${net.sql}) net JOIN transactions t ON t.id = net.id
     WHERE t.flow = 'spend' AND t.origin = 'sms' AND t.is_self_transfer = 0
       AND ${NAMED} IS NOT NULL AND net.net_all > 0
     GROUP BY LOWER(${NAMED}) ORDER BY ${order} LIMIT ?`,
    [...net.params, n],
  );
  return rows.map((r) => ({ name: r.name, spent: pesewas(r.spent), count: r.count }));
}

/**
 * The largest single payment by net amount (refunds taken off, fees not added). The earliest wins
 * a tie. `who` is the name or what a typed-in expense was called, never a merchant code.
 */
export async function biggestPayment(db: Db, range: TimeRange): Promise<BiggestPayment | null> {
  const net = netPerTransaction(range);
  const row = await db.get<{ amount: number; who: string | null; iso: string }>(
    `SELECT net.net_amount AS amount, ${NAMED} AS who,
            strftime('%Y-%m-%d', t.occurred_at / 1000, 'unixepoch') AS iso
     FROM (${net.sql}) net JOIN transactions t ON t.id = net.id
     WHERE t.flow = 'spend' AND net.net_amount > 0
     ORDER BY net.net_amount DESC, t.occurred_at, t.id LIMIT 1`,
    net.params,
  );
  return row ? { amount: pesewas(row.amount), who: row.who, iso: row.iso } : null;
}

/** Net spend per UTC weekday in the range, index 0 = Sunday; a weekday that nets below zero reads zero. */
export async function weekdayTotals(db: Db, range: TimeRange): Promise<Pesewas[]> {
  const time = inRange('at', range);
  const rows = await db.all<{ weekday: number; spent: number }>(
    `SELECT CAST(strftime('%w', at / 1000, 'unixepoch') AS INTEGER) AS weekday, SUM(pesewas) AS spent
     FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql} GROUP BY weekday`,
    time.params,
  );
  const totals = Array.from({ length: 7 }, () => 0);
  for (const r of rows) totals[r.weekday] = Math.max(0, r.spent);
  return totals.map(pesewas);
}

/**
 * How many UTC days had net spending, and how many days lie between the first and the last of
 * them (both included). Days outside that stretch are not "no-spend days": the history there
 * simply is not known.
 */
export async function activeDays(
  db: Db,
  range: TimeRange,
): Promise<{ span: number; active: number }> {
  const time = inRange('at', range);
  const rows = await db.all<{ day: string }>(
    `SELECT strftime('%Y-%m-%d', at / 1000, 'unixepoch') AS day
     FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql}
     GROUP BY day HAVING SUM(pesewas) > 0 ORDER BY day`,
    time.params,
  );
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return { span: 0, active: 0 };
  const span = (Date.parse(last.day) - Date.parse(first.day)) / DAY_MS + 1;
  return { span, active: rows.length };
}

/** Everything `buildWrapped` needs for a year or for all time, read with the Insights queries where they exist. */
export async function wrappedFacts(db: Db, scope: WrappedScope): Promise<WrappedFacts> {
  const range = scope.kind === 'year' ? yearRange(scope.year) : ALL_TIME;
  let totals: Pick<WrappedFacts, 'spent' | 'moneyIn' | 'payments' | 'months'>;
  if (scope.kind === 'year') {
    const { spent, moneyIn, payments, months } = await yearSummary(db, scope.year);
    totals = { spent, moneyIn, payments, months };
  } else {
    const { spent, moneyIn, payments } = await allTimeSummary(db);
    const months = (await monthsWithData(db)).map((m) => ({
      ...noMonth(m.monthId),
      out: m.spent,
      in: m.moneyIn,
    }));
    totals = { spent, moneyIn, payments, months };
  }

  const [spend, categories, biggest, bySpend, byCount, weekdays, days] = await Promise.all([
    categorySpend(db, range),
    listCategories(db),
    biggestPayment(db, range),
    topCounterparties(db, range, 1, 'spent'),
    topCounterparties(db, range, 1, 'count'),
    weekdayTotals(db, range),
    activeDays(db, range),
  ]);
  return {
    scope,
    ...totals,
    categories: spend.flatMap((s) => {
      const c = categories.find((x) => x.id === s.categoryId);
      return c ? [{ id: c.id, name: c.name, color: c.color, amount: s.amount }] : [];
    }),
    biggest,
    topBySpend: bySpend[0] ?? null,
    topByCount: byCount[0] ?? null,
    weekdays,
    days,
  };
}
