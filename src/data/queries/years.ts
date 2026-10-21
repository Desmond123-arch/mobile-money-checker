import type { Db } from '../db';
import { ALL_TIME, yearMonthIds, yearRange } from '@/domain/calendar/year';
import { pesewas } from '@/domain/money';
import { noMonth, type MonthFlow } from '@/domain/summary/trend';
import {
  buildAllTimeSummary,
  buildYearSummary,
  yearFlowsOf,
  type AllTimeSummary,
  type YearFlow,
  type YearSummary,
} from '@/domain/summary/year';

import { monthlyFlows } from './insights';
import { monthsWithData } from './months';
import { inRange } from './sql';
import { paymentCount } from './transactions';

/** Money out and in per year, for every year that has at least one ledger line, oldest first. */
export async function yearsWithData(db: Db): Promise<YearFlow[]> {
  return yearFlowsOf(await monthFlowsWithData(db));
}

async function monthFlowsWithData(db: Db): Promise<MonthFlow[]> {
  const months = await monthsWithData(db);
  return months.map((m) => ({ ...noMonth(m.monthId), out: m.spent, in: m.moneyIn }));
}

async function spendIn(db: Db, range: { start: number; end: number }) {
  const time = inRange('at', range);
  const row = await db.get<{ s: number | null }>(
    `SELECT SUM(pesewas) AS s FROM ledger_lines WHERE bucket = 'spend' AND ${time.sql}`,
    time.params,
  );
  return pesewas(row?.s ?? 0);
}

/** The numbers behind the year view: twelve months, the payment count, and the year before's spend. */
export async function yearSummary(db: Db, year: number): Promise<YearSummary> {
  const months = await monthlyFlows(db, yearMonthIds(year)[11]!, 12);
  const payments = await paymentCount(db, yearRange(year));
  const previous = await spendIn(db, yearRange(year - 1));
  return buildYearSummary(year, months, payments, previous);
}

/** Everything since the first payment: totals, the span, a total per year, the busiest year and month. */
export async function allTimeSummary(db: Db): Promise<AllTimeSummary> {
  return buildAllTimeSummary(await monthFlowsWithData(db), await paymentCount(db, ALL_TIME));
}
