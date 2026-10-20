import type { Pesewas } from '../money';

/** What Home shows for one month. The summary query will return this shape. */
export interface MonthSummary {
  label: string;
  spent: Pesewas;
  deltaLabel: string;
  deltaCompare: string;
  moneyIn: Pesewas;
  feesAndTax: Pesewas;
  payments: number;
  /** Payments still waiting for a note. */
  needNote: number;
  today: number;
  daysInMonth: number;
  /** Spend per day, day 1 first. Days after today are zero. */
  daily: readonly Pesewas[];
  /** "Fri 9 Oct, GHS 260.00", the biggest day. Null when nothing was spent. */
  peakLabel: string | null;
}
