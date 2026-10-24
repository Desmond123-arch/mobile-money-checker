import { monthName, monthShort } from '../calendar/month';
import { pesewas, type Pesewas } from '../money';

export interface MonthFlow {
  monthId: string;
  out: Pesewas;
  in: Pesewas;
}

export interface MonthBar {
  label: string;
  /** Whole cedis, for the bar chart. */
  out: number;
  in: number;
}

const cedis = (p: number) => Math.round(Math.max(0, p) / 100);

export const monthBars = (flows: readonly MonthFlow[]): MonthBar[] =>
  flows.map((f) => ({ label: monthShort(f.monthId), out: cedis(f.out), in: cedis(f.in) }));

/** The first month with the highest spend, or null when nothing was spent in any of them. */
export function biggestMonth(flows: readonly MonthFlow[]): MonthFlow | null {
  let best: MonthFlow | null = null;
  for (const f of flows) if (f.out > 0 && (best === null || f.out > best.out)) best = f;
  return best;
}

export function trendHeading(flows: readonly MonthFlow[]): { title: string; subtitle: string } {
  const first = flows[0];
  const last = flows[flows.length - 1];
  const best = biggestMonth(flows);
  return {
    title: best
      ? `${monthName(best.monthId)} was your biggest month`
      : 'Nothing spent in these months',
    subtitle:
      first && last
        ? `Money out and in, ${monthName(first.monthId)} to ${monthName(last.monthId)}`
        : 'Money out and in',
  };
}

export const noMonth = (monthId: string): MonthFlow => ({
  monthId,
  out: pesewas(0),
  in: pesewas(0),
});
