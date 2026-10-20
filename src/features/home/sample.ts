import { formatGhs, pesewas } from '@/domain/money';
import type { MonthSummary } from '@/domain/summary/month';
import { MONTH_OPTIONS, type MonthOption } from '@/features/period';

const cedis = (n: number) => pesewas(n * 100);

export const SAMPLE_MONTH: MonthSummary = {
  label: 'October 2026',
  spent: pesewas(124050),
  deltaLabel: '12% less',
  deltaCompare: 'than this time in September',
  moneyIn: cedis(800),
  payments: 38,
  needNote: 3,
  today: 20,
  daysInMonth: 31,
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
  payments: 0,
  needNote: 0,
  peakLabel: null,
  daily: Array.from({ length: 31 }, () => pesewas(0)),
};

const DAILY_PATTERN = SAMPLE_MONTH.daily.slice(0, 20);

function daysIn(monthId: string): number {
  const [year = 0, month = 1] = monthId.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function summaryFor(option: MonthOption): MonthSummary {
  if (option.isCurrent) return SAMPLE_MONTH;

  const days = daysIn(option.id);
  const weights: number[] = Array.from(
    { length: days },
    (_, i) => DAILY_PATTERN[i % DAILY_PATTERN.length] ?? 0,
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  const daily = weights.map((w) => pesewas(Math.round((w * option.spent) / total)));
  const peak = Math.max(...daily);
  const peakDay = daily.indexOf(pesewas(peak)) + 1;

  const index = MONTH_OPTIONS.findIndex((m) => m.id === option.id);
  const previous = MONTH_OPTIONS[index - 1];
  const delta =
    previous === undefined
      ? { label: 'First month', compare: 'on record' }
      : {
          label: `${Math.round((Math.abs(option.spent - previous.spent) * 100) / previous.spent)}% ${option.spent < previous.spent ? 'less' : 'more'}`,
          compare: `than ${previous.short}`,
        };

  return {
    label: option.label,
    spent: option.spent,
    deltaLabel: delta.label,
    deltaCompare: delta.compare,
    moneyIn: option.moneyIn,
    payments: Math.round(option.spent / 3300),
    needNote: 0,
    today: days,
    daysInMonth: days,
    peakLabel: `Day ${peakDay}, ${formatGhs(pesewas(peak))}`,
    daily,
  };
}
