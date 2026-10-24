import { monthLabel, monthShort } from '@/domain/calendar/month';
import { pesewas, type Pesewas } from '@/domain/money';

export interface MonthOption {
  /** `YYYY-MM`, UTC. */
  id: string;
  label: string;
  short: string;
  isCurrent: boolean;
  spent: Pesewas;
  moneyIn: Pesewas;
}

export interface MonthTotalsInput {
  monthId: string;
  spent: Pesewas;
  moneyIn: Pesewas;
}

export function monthOption(
  id: string,
  currentId: string,
  totals?: Omit<MonthTotalsInput, 'monthId'>,
): MonthOption {
  return {
    id,
    label: monthLabel(id),
    short: monthShort(id),
    isCurrent: id === currentId,
    spent: totals?.spent ?? pesewas(0),
    moneyIn: totals?.moneyIn ?? pesewas(0),
  };
}

/** The months with data (oldest first), plus the current month even when it has none. */
export function buildMonthOptions(
  totals: readonly MonthTotalsInput[],
  currentId: string,
): MonthOption[] {
  const options = totals.map((t) => monthOption(t.monthId, currentId, t));
  if (!options.some((o) => o.isCurrent)) options.push(monthOption(currentId, currentId));
  return options.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The month to open on. The current month when it has data or nothing has data at all; otherwise
 * the latest month that does, because a backup export is usually older than today.
 */
export function defaultMonthId(dataMonthIds: readonly string[], currentId: string): string {
  if (dataMonthIds.length === 0 || dataMonthIds.includes(currentId)) return currentId;
  return [...dataMonthIds].sort().at(-1)!;
}

export const monthIdOfIso = (iso: string): string => iso.slice(0, 7);
