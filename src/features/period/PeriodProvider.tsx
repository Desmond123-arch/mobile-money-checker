import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CURRENT_MONTH, MONTH_OPTIONS, type MonthOption } from './months';

interface PeriodValue {
  month: MonthOption;
  selectMonth: (id: string) => void;
}

const PeriodContext = createContext<PeriodValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<MonthOption>(CURRENT_MONTH);
  const value = useMemo<PeriodValue>(
    () => ({
      month,
      selectMonth: (id) => setMonth(MONTH_OPTIONS.find((m) => m.id === id) ?? CURRENT_MONTH),
    }),
    [month],
  );
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (!value) throw new Error('usePeriod must be used inside PeriodProvider');
  return value;
}
