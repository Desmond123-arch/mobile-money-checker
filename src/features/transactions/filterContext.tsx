import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface FilterValue {
  categoryId: string | null;
  setCategoryId: (id: string | null) => void;
}

const FilterContext = createContext<FilterValue | null>(null);

export function TransactionFilterProvider({ children }: { children: ReactNode }) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const value = useMemo(() => ({ categoryId, setCategoryId }), [categoryId]);
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useTransactionFilter(): FilterValue {
  const value = useContext(FilterContext);
  if (!value) throw new Error('useTransactionFilter must be used inside TransactionFilterProvider');
  return value;
}
