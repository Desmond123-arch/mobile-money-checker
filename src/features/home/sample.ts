import { pesewas } from '@/domain/money';
import type { MonthSummary } from '@/domain/summary/month';

const cedis = (n: number) => pesewas(n * 100);

export const SAMPLE_MONTH: MonthSummary = {
  label: 'October 2026',
  spent: pesewas(124050),
  deltaLabel: '12% less',
  deltaCompare: 'than this time in September',
  moneyIn: cedis(800),
  feesAndTax: pesewas(620),
  payments: 38,
  needNote: 3,
  today: 20,
  daysInMonth: 31,
  /** Whole-cedi spend per day, day 1 first. Days after today are zero. */
  peakLabel: 'Fri 9 Oct, GHS 260.00',
  daily: [
    51, 38, 10, 65, 171, 19, 35, 46, 260, 30, 24, 10, 111, 41, 27, 149, 35, 60, 46, 27, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ].map(cedis),
};

export const EMPTY_MONTH: MonthSummary = {
  ...SAMPLE_MONTH,
  spent: pesewas(0),
  moneyIn: pesewas(0),
  feesAndTax: pesewas(0),
  payments: 0,
  needNote: 0,
  peakLabel: null,
  daily: Array.from({ length: 31 }, () => pesewas(0)),
};
