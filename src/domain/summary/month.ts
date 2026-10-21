import { isoDate, shortDate } from '../calendar/week';
import { daysInMonth, monthLabel, monthName } from '../calendar/month';
import { formatGhs, pesewas, type Pesewas } from '../money';

export interface MonthSummary {
  label: string;
  spent: Pesewas;
  deltaLabel: string;
  deltaCompare: string;
  moneyIn: Pesewas;
  payments: number;
  needNote: number;
  today: number;
  daysInMonth: number;
  daily: readonly Pesewas[];
  peakLabel: string | null;
}

export function dailyAverage(spent: Pesewas, daysElapsed: number): Pesewas {
  return pesewas(daysElapsed > 0 ? Math.round(spent / daysElapsed) : 0);
}

/** What the database says about one month, before it is worded for the screen. */
export interface MonthFacts {
  /** `YYYY-MM`, UTC. */
  monthId: string;
  /** Whether the month is the one the device clock is in, so only part of it has happened. */
  isCurrent: boolean;
  /** Days of the month that count: the day of the month today when current, else all of them. */
  elapsedDays: number;
  spent: Pesewas;
  moneyIn: Pesewas;
  payments: number;
  needNote: number;
  /** Net spend per day, index 0 is the 1st. Only days that have data need an entry. */
  spendByDay: ReadonlyMap<number, Pesewas>;
  /** Spend in the month before over the same number of days; null when that month has no data. */
  previous: { monthId: string; spent: Pesewas } | null;
}

function delta(facts: MonthFacts): Pick<MonthSummary, 'deltaLabel' | 'deltaCompare'> {
  const { previous, spent, isCurrent } = facts;
  if (previous === null || previous.spent <= 0) {
    return { deltaLabel: 'First month', deltaCompare: 'on record' };
  }
  const name = monthName(previous.monthId);
  const compare = isCurrent ? `than this time in ${name}` : `than ${name}`;
  if (spent === previous.spent) return { deltaLabel: 'No change', deltaCompare: `from ${name}` };
  const percent = Math.round((Math.abs(spent - previous.spent) * 100) / previous.spent);
  return {
    deltaLabel: `${percent}% ${spent < previous.spent ? 'less' : 'more'}`,
    deltaCompare: compare,
  };
}

export function buildMonthSummary(facts: MonthFacts): MonthSummary {
  const days = daysInMonth(facts.monthId);
  const daily = Array.from({ length: days }, (_, i) =>
    pesewas(Math.max(0, facts.spendByDay.get(i + 1) ?? 0)),
  );
  const peak = Math.max(...daily);
  const peakDay = daily.indexOf(pesewas(peak)) + 1;
  const peakIso = isoDate(
    new Date(`${facts.monthId}-${String(peakDay).padStart(2, '0')}T00:00:00Z`),
  );
  return {
    label: monthLabel(facts.monthId),
    spent: facts.spent,
    ...delta(facts),
    moneyIn: facts.moneyIn,
    payments: facts.payments,
    needNote: facts.needNote,
    today: facts.elapsedDays,
    daysInMonth: days,
    daily,
    peakLabel: peak > 0 ? `${shortDate(peakIso)}, ${formatGhs(pesewas(peak))}` : null,
  };
}
