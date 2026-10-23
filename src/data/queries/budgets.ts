import type { Db } from '../db';
import { planRange, type PlanSpan } from '@/domain/budget/plan';
import { previousSpan } from '@/domain/budget/suggest';
import { planDays } from '@/domain/budget/plan';
import { buildBudgetView, type BudgetView, type Limit } from '@/domain/budget/view';
import type { CategorySpend } from '@/domain/category/share';

import { categorySpend } from './categories';
import { UI_CATEGORY_ID_SQL } from './sql';

export interface PlanRow extends PlanSpan {
  id: number;
  name: string | null;
  /** Pesewas. */
  total: number;
  /** Net spend over the plan's days, in pesewas. */
  spent: number;
}

interface RawPlan {
  id: number;
  name: string | null;
  start_day: string;
  end_day: string;
  total_pesewas: number;
  spent: number;
}

const toRow = (r: RawPlan): PlanRow => ({
  id: r.id,
  name: r.name,
  startDay: r.start_day,
  endDay: r.end_day,
  total: r.total_pesewas,
  spent: r.spent,
});

// A plan's days are UTC dates, so its range is the date at 00:00 UTC to the day after the last.
const PLAN_SQL = `
  SELECT p.id, p.name, p.start_day, p.end_day, p.total_pesewas,
    COALESCE((SELECT SUM(l.pesewas) FROM ledger_lines l
              WHERE l.bucket = 'spend'
                AND l.at >= CAST(strftime('%s', p.start_day) AS INTEGER) * 1000
                AND l.at <  (CAST(strftime('%s', p.end_day) AS INTEGER) + 86400) * 1000), 0) AS spent
  FROM budget_plans p`;

/** Every plan, latest first, each with what was spent over its days. */
export async function listPlans(db: Db): Promise<PlanRow[]> {
  return (await db.all<RawPlan>(`${PLAN_SQL} ORDER BY p.start_day DESC`)).map(toRow);
}

export async function budgetPlan(db: Db, id: number): Promise<PlanRow | null> {
  const row = await db.get<RawPlan>(`${PLAN_SQL} WHERE p.id = ?`, [id]);
  return row === null ? null : toRow(row);
}

/** A plan's category limits as UI category ids, biggest first. */
export async function planLimits(db: Db, planId: number): Promise<Limit[]> {
  const rows = await db.all<{ category_id: string; limit_pesewas: number }>(
    `SELECT ${UI_CATEGORY_ID_SQL} AS category_id, b.limit_pesewas
     FROM budget_limits b JOIN categories c ON c.id = b.category_id
     WHERE b.plan_id = ?
     ORDER BY b.limit_pesewas DESC, c.sort_order`,
    [planId],
  );
  return rows.map((r) => ({ categoryId: r.category_id, amount: r.limit_pesewas }));
}

/** One plan with its limits and the spending measured against them, or null if it is gone. */
export async function budgetView(
  db: Db,
  planId: number,
  todayIso: string,
): Promise<BudgetView | null> {
  const plan = await budgetPlan(db, planId);
  if (plan === null) return null;
  const spend = await categorySpend(db, planRange(plan.startDay, plan.endDay));
  return buildBudgetView(
    {
      id: plan.id,
      name: plan.name,
      startDay: plan.startDay,
      endDay: plan.endDay,
      total: plan.total,
    },
    await planLimits(db, planId),
    spend,
    plan.spent,
    todayIso,
  );
}

export interface BudgetHistory {
  spend: CategorySpend[];
  days: number;
}

/** What was spent in the same number of days before `startDay`, to start a plan from. */
export async function budgetHistory(
  db: Db,
  startDay: string,
  days: number,
): Promise<BudgetHistory> {
  const span = previousSpan(startDay, days);
  return {
    spend: await categorySpend(db, planRange(span.startDay, span.endDay)),
    days: planDays(span.startDay, span.endDay),
  };
}
