import type { CategorySpend } from '../category/share';
import { type Pace, type Progress, paceLine, paceOf, progressOf } from './progress';
import type { PlanSpan, PlanStatus } from './plan';
import { planStatus } from './plan';

export interface PlanFacts extends PlanSpan {
  id: number;
  name: string | null;
  /** Pesewas. */
  total: number;
}

export interface Limit {
  categoryId: string;
  amount: number;
}

export interface CategoryLine {
  categoryId: string;
  progress: Progress;
}

export interface BudgetView {
  plan: PlanFacts;
  status: PlanStatus;
  pace: Pace;
  total: Progress;
  /** The categories that have a limit, biggest limit first. */
  categories: CategoryLine[];
  /**
   * Everything without a limit: what the plan leaves unplanned, against what was spent outside
   * the limited categories. Null when no category has a limit, or nothing is planned or spent there.
   */
  rest: Progress | null;
  /** What is left to give a category: the total minus the limits already set. */
  unplanned: number;
  headline: string;
}

export function buildBudgetView(
  plan: PlanFacts,
  limits: readonly Limit[],
  spendByCategory: readonly CategorySpend[],
  totalSpent: number,
  todayIso: string,
): BudgetView {
  const spentIn = new Map(spendByCategory.map((s) => [s.categoryId, s.amount as number]));
  const categories = [...limits]
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId))
    .map((l) => ({
      categoryId: l.categoryId,
      progress: progressOf(l.amount, spentIn.get(l.categoryId) ?? 0),
    }));

  const limited = limits.reduce((sum, l) => sum + l.amount, 0);
  const limitedSpent = categories.reduce((sum, c) => sum + c.progress.spent, 0);
  const unplanned = Math.max(plan.total - limited, 0);
  const restSpent = Math.max(totalSpent - limitedSpent, 0);
  const rest =
    limits.length === 0 || (unplanned === 0 && restSpent === 0)
      ? null
      : progressOf(unplanned, restSpent);

  const total = progressOf(plan.total, totalSpent);
  const pace = paceOf(plan, totalSpent, todayIso);
  return {
    plan,
    status: planStatus(plan, todayIso),
    pace,
    total,
    categories,
    rest,
    unplanned,
    headline: paceLine(plan, total, pace),
  };
}
