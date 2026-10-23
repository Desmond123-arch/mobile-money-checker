import type { CategorySpend } from '../category/share';
import { addDays, type PlanSpan } from './plan';

const GHS = 100;
const LIMIT_STEP = 10 * GHS;
const TOTAL_STEP = 50 * GHS;
const MAX_LIMITS = 5;

/** The same number of days straight before `startDay`: what the new plan is compared with. */
export function previousSpan(startDay: string, days: number): PlanSpan {
  return { startDay: addDays(startDay, -days), endDay: addDays(startDay, -1) };
}

const roundUp = (n: number, step: number): number => Math.ceil(n / step) * step;

export interface Suggestion {
  total: number;
  limits: { categoryId: string; amount: number }[];
}

/**
 * A starting plan from what was really spent: the same pace as the days before, rounded up to
 * tidy amounts, with limits for the biggest few categories. Null when nothing was spent.
 */
export function suggestPlan(
  history: readonly CategorySpend[],
  historyDays: number,
  length: number,
): Suggestion | null {
  const spent = history.reduce((sum, h) => sum + h.amount, 0);
  if (spent <= 0 || historyDays <= 0 || length <= 0) return null;
  const scale = length / historyDays;

  const limits = [...history]
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId))
    .slice(0, MAX_LIMITS)
    .map((h) => ({ categoryId: h.categoryId, amount: roundUp(h.amount * scale, LIMIT_STEP) }));

  const limited = limits.reduce((sum, l) => sum + l.amount, 0);
  return { total: roundUp(Math.max(spent * scale, limited), TOTAL_STEP), limits };
}

/**
 * The largest limits, in order, that still add up to no more than `total`. A suggestion made for
 * a bigger total can then be applied to a plan the user sized smaller.
 */
export function fitToTotal<T extends { amount: number }>(limits: readonly T[], total: number): T[] {
  const fitted: T[] = [];
  let sum = 0;
  for (const limit of limits) {
    if (sum + limit.amount > total) continue;
    fitted.push(limit);
    sum += limit.amount;
  }
  return fitted;
}
