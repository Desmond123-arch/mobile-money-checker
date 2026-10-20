import type { Pesewas } from '../money';

export interface MonthSummary {
  label: string;
  spent: Pesewas;
  deltaLabel: string;
  deltaCompare: string;
  moneyIn: Pesewas;
  feesAndTax: Pesewas;
  payments: number;
  needNote: number;
  today: number;
  daysInMonth: number;
  daily: readonly Pesewas[];
  peakLabel: string | null;
}
