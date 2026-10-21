import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { monthIdOfIso, monthOption, type MonthOption } from './months';
import { useMonthOptions } from './useMonthOptions';

export type Period =
  { kind: 'month'; month: MonthOption } | { kind: 'day'; iso: string; month: MonthOption };

interface PeriodValue {
  month: MonthOption;
  period: Period;
  /** Every month the pickers offer, oldest first. */
  months: readonly MonthOption[];
  /** Whether any month has data, so screens can tell "nothing yet" from "nothing this month". */
  hasData: boolean;
  /** False until the months have been read; screens hold their first render until then. */
  ready: boolean;
  selectMonth: (id: string) => void;
  selectDay: (iso: string) => void;
}

type Choice = { kind: 'month'; monthId: string } | { kind: 'day'; iso: string };

const PeriodContext = createContext<PeriodValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const { options, currentId, defaultId, hasData, ready } = useMonthOptions();
  // Until the user picks something the period follows the data: it moves to the latest month
  // with data once an import lands, instead of staying on an empty current month.
  const [choice, setChoice] = useState<Choice | null>(null);

  const value = useMemo<PeriodValue>(() => {
    const optionFor = (id: string) =>
      options.find((o) => o.id === id) ?? monthOption(id, currentId);
    const period: Period =
      choice?.kind === 'day'
        ? { kind: 'day', iso: choice.iso, month: optionFor(monthIdOfIso(choice.iso)) }
        : { kind: 'month', month: optionFor(choice?.monthId ?? defaultId) };
    return {
      month: period.month,
      period,
      months: options,
      hasData,
      ready,
      selectMonth: (monthId) => setChoice({ kind: 'month', monthId }),
      selectDay: (iso) => setChoice({ kind: 'day', iso }),
    };
  }, [choice, options, currentId, defaultId, hasData, ready]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (!value) throw new Error('usePeriod must be used inside PeriodProvider');
  return value;
}
