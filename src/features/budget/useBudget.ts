import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  budgetHistory,
  budgetView,
  listPlans,
  type BudgetHistory,
  type PlanRow,
} from '@/data/queries';
import { featuredPlan } from '@/domain/budget/plan';
import type { BudgetView } from '@/domain/budget/view';
import { isoDate } from '@/domain/calendar/week';
import { useDb } from '@/features/app/DbProvider';
import { useToday } from '@/features/period';

// Every key starts with `budget`, which every ledger write refreshes (`MONEY_KEYS` in `writeGroups.ts`).

/** Every plan, latest first. `undefined` while loading. */
export function usePlans(): PlanRow[] | undefined {
  const db = useDb();
  return useQuery({ queryKey: ['budget', 'plans'], queryFn: () => listPlans(db) }).data;
}

/** `null` when the plan is gone or no plan is asked for; `undefined` while loading. */
export function useBudgetView(planId: number | null): BudgetView | null | undefined {
  const db = useDb();
  const todayIso = isoDate(useToday());
  const query = useQuery({
    queryKey: ['budget', 'view', planId, todayIso],
    queryFn: () => (planId === null ? null : budgetView(db, planId, todayIso)),
  });
  return query.data;
}

/** What was spent in the `days` before `startDay`. `undefined` while loading. */
export function useBudgetHistory(startDay: string | null, days: number): BudgetHistory | undefined {
  const db = useDb();
  return useQuery({
    queryKey: ['budget', 'history', startDay, days],
    queryFn: () => (startDay === null ? { spend: [], days } : budgetHistory(db, startDay, days)),
  }).data;
}

export interface Featured {
  plans: PlanRow[];
  featured: PlanRow | null;
}

/** The plan to put in front of the user, with all plans. `undefined` while loading. */
export function useFeaturedPlan(): Featured | undefined {
  const plans = usePlans();
  const todayIso = isoDate(useToday());
  return useMemo(
    () => (plans === undefined ? undefined : { plans, featured: featuredPlan(plans, todayIso) }),
    [plans, todayIso],
  );
}
