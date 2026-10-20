import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CURRENT_MONTH, MONTH_OPTIONS, monthOfIso, type MonthOption } from './months';

export type Period =
  { kind: 'month'; month: MonthOption } | { kind: 'day'; iso: string; month: MonthOption };

interface PeriodValue {
  month: MonthOption;
  period: Period;
  selectMonth: (id: string) => void;
  selectDay: (iso: string) => void;
}

const PeriodContext = createContext<PeriodValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>({ kind: 'month', month: CURRENT_MONTH });
  const value = useMemo<PeriodValue>(
    () => ({
      month: period.month,
      period,
      selectMonth: (id) =>
        setPeriod({
          kind: 'month',
          month: MONTH_OPTIONS.find((m) => m.id === id) ?? CURRENT_MONTH,
        }),
      selectDay: (iso) => {
        const month = monthOfIso(iso);
        if (month) setPeriod({ kind: 'day', iso, month });
      },
    }),
    [period],
  );
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (!value) throw new Error('usePeriod must be used inside PeriodProvider');
  return value;
}
