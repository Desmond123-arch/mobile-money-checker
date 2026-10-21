import { monthShort } from '../calendar/month';
import { yearOfMonth } from '../calendar/year';
import { pesewas, type Pesewas } from '../money';
import { biggestMonth, type MonthFlow } from './trend';

export interface YearFlow {
  year: number;
  out: Pesewas;
  in: Pesewas;
}

export interface YearSummary {
  year: number;
  spent: Pesewas;
  moneyIn: Pesewas;
  payments: number;
  /** January to December, empty months as zero. */
  months: MonthFlow[];
  biggestMonth: MonthFlow | null;
  /** Spend of the year before, or null when that year spent nothing. */
  previousSpent: Pesewas | null;
}

export interface AllTimeSummary {
  spent: Pesewas;
  moneyIn: Pesewas;
  payments: number;
  /** `YYYY-MM` of the first and last month with data; null when there is none. */
  firstMonthId: string | null;
  lastMonthId: string | null;
  years: YearFlow[];
  busiestYear: YearFlow | null;
  busiestMonth: MonthFlow | null;
}

const sum = (values: readonly number[]): Pesewas => pesewas(values.reduce((a, b) => a + b, 0));

export function buildYearSummary(
  year: number,
  months: readonly MonthFlow[],
  payments: number,
  previousSpent: Pesewas,
): YearSummary {
  return {
    year,
    spent: sum(months.map((m) => m.out)),
    moneyIn: sum(months.map((m) => m.in)),
    payments,
    months: [...months],
    biggestMonth: biggestMonth(months),
    previousSpent: previousSpent > 0 ? previousSpent : null,
  };
}

/** Groups month totals into years, oldest first. */
export function yearFlowsOf(months: readonly MonthFlow[]): YearFlow[] {
  const byYear = new Map<number, YearFlow>();
  for (const m of months) {
    const year = yearOfMonth(m.monthId);
    const prev = byYear.get(year);
    byYear.set(year, {
      year,
      out: pesewas((prev?.out ?? 0) + m.out),
      in: pesewas((prev?.in ?? 0) + m.in),
    });
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export function buildAllTimeSummary(
  months: readonly MonthFlow[],
  payments: number,
): AllTimeSummary {
  const sorted = [...months].sort((a, b) => (a.monthId < b.monthId ? -1 : 1));
  const years = yearFlowsOf(sorted);
  let busiestYear: YearFlow | null = null;
  for (const y of years) {
    if (y.out > 0 && (busiestYear === null || y.out > busiestYear.out)) busiestYear = y;
  }
  return {
    spent: sum(sorted.map((m) => m.out)),
    moneyIn: sum(sorted.map((m) => m.in)),
    payments,
    firstMonthId: sorted[0]?.monthId ?? null,
    lastMonthId: sorted.at(-1)?.monthId ?? null,
    years,
    busiestYear,
    busiestMonth: biggestMonth(sorted),
  };
}

const monthYear = (id: string) => `${monthShort(id)} ${yearOfMonth(id)}`;

/** "Apr 2024 to Jun 2026", or just "Apr 2024" when the history is one month. */
export function spanLabel(firstMonthId: string, lastMonthId: string): string {
  return firstMonthId === lastMonthId
    ? monthYear(firstMonthId)
    : `${monthYear(firstMonthId)} to ${monthYear(lastMonthId)}`;
}

export const yearBars = (years: readonly YearFlow[]) =>
  years.map((y) => ({
    label: String(y.year),
    out: Math.round(Math.max(0, y.out) / 100),
    in: Math.round(Math.max(0, y.in) / 100),
  }));
