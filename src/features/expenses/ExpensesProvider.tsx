import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Pesewas } from '@/domain/money';
import type { TransactionRow } from '@/domain/transaction/transaction';

export type ExpenseDay = 'today' | 'yesterday';

export interface AddedExpense {
  day: ExpenseDay;
  row: TransactionRow;
}

export interface NewExpense {
  name: string;
  amount: Pesewas;
  categoryId: string;
  day: ExpenseDay;
}

interface ExpensesValue {
  added: readonly AddedExpense[];
  addExpense: (expense: NewExpense) => void;
}

const ExpensesContext = createContext<ExpensesValue | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [added, setAdded] = useState<readonly AddedExpense[]>([]);
  const value = useMemo<ExpensesValue>(
    () => ({
      added,
      addExpense: ({ name, amount, categoryId, day }) =>
        setAdded((current) => [
          {
            day,
            row: {
              id: `manual-${current.length + 1}`,
              counterparty: name,
              categoryId,
              note: '',
              direction: 'out',
              amount,
              manual: true,
            },
          },
          ...current,
        ]),
    }),
    [added],
  );
  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses(): ExpensesValue {
  const value = useContext(ExpensesContext);
  if (!value) throw new Error('useExpenses must be used inside ExpensesProvider');
  return value;
}
