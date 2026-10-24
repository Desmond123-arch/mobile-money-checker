import type { Db } from '@/data/db';
import {
  cleanName,
  limitProblem,
  limitsProblem,
  planProblem,
  totalFromDaily,
  type PlanSpan,
} from '@/domain/budget/plan';

import { categoryRowId } from './categoryRef';
import { ledgerQueue } from './writeQueue';

export interface LimitInput {
  /** UI category id. */
  categoryId: string;
  /** Pesewas. */
  amount: number;
}

export interface PlanInput extends PlanSpan {
  name?: string | null;
  /** Pesewas. Ignored when `daily` is given. */
  total?: number | null;
  /** Pesewas a day. The stored total is this times the plan's days. */
  daily?: number | null;
}

interface Resolved extends PlanSpan {
  name: string | null;
  total: number | null;
  daily: number | null;
}

function resolve(input: PlanInput): Resolved {
  const daily = input.daily ?? null;
  const total =
    daily === null ? (input.total ?? null) : totalFromDaily(daily, input.startDay, input.endDay);
  return { startDay: input.startDay, endDay: input.endDay, name: input.name ?? null, total, daily };
}

/** A refused plan carries the words the form shows. */
export type PlanResult = { ok: true; id: number } | { ok: false; message: string };
export type LimitResult = { ok: true } | { ok: false; message: string };

const OTHERS_SQL = 'SELECT start_day, end_day FROM budget_plans WHERE id IS NOT ?';

async function othersOf(tx: Db, ownId: number | null): Promise<PlanSpan[]> {
  const rows = await tx.all<{ start_day: string; end_day: string }>(OTHERS_SQL, [ownId]);
  return rows.map((r) => ({ startDay: r.start_day, endDay: r.end_day }));
}

async function limitsTotal(tx: Db, planId: number, exceptCategory: number | null = null) {
  const row = await tx.get<{ s: number | null }>(
    `SELECT SUM(limit_pesewas) AS s FROM budget_limits
     WHERE plan_id = ? AND category_id IS NOT ?`,
    [planId, exceptCategory],
  );
  return row?.s ?? 0;
}

async function livePlan(tx: Db, id: number): Promise<{ total: number }> {
  const row = await tx.get<{ total_pesewas: number }>(
    'SELECT total_pesewas FROM budget_plans WHERE id = ?',
    [id],
  );
  if (row === null) throw new Error(`no plan ${id}`);
  return { total: row.total_pesewas };
}

/** Rows to insert for a set of limits, or the reason one is refused. */
async function limitRows(
  tx: Db,
  limits: readonly LimitInput[],
  total: number,
): Promise<{ id: number; amount: number }[] | string> {
  const problem = limitsProblem(limits, total);
  if (problem !== null) return problem;
  const rows: { id: number; amount: number }[] = [];
  for (const l of limits) {
    const id = await categoryRowId(tx, l.categoryId);
    if (id === null) return 'That category is gone.';
    rows.push({ id, amount: l.amount });
  }
  return rows;
}

const insertLimits = async (
  tx: Db,
  planId: number,
  rows: readonly { id: number; amount: number }[],
) => {
  for (const row of rows) {
    await tx.run(
      'INSERT INTO budget_limits (plan_id, category_id, limit_pesewas) VALUES (?, ?, ?)',
      [planId, row.id, row.amount],
    );
  }
};

/** Starts a plan, with its first limits if there are any. One exclusive transaction. */
export function createPlan(
  db: Db,
  input: PlanInput,
  limits: readonly LimitInput[] = [],
  now: number = Date.now(),
): Promise<PlanResult> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<PlanResult> => {
      const plan = resolve(input);
      const problem = planProblem(plan, { others: await othersOf(tx, null), limitsTotal: 0 });
      if (problem !== null) return { ok: false, message: problem };
      const rows = await limitRows(tx, limits, plan.total!);
      if (typeof rows === 'string') return { ok: false, message: rows };
      const { lastInsertRowId } = await tx.run(
        `INSERT INTO budget_plans (name, start_day, end_day, total_pesewas, daily_pesewas,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cleanName(plan.name), plan.startDay, plan.endDay, plan.total, plan.daily, now, now],
      );
      await insertLimits(tx, lastInsertRowId, rows);
      return { ok: true, id: lastInsertRowId };
    }),
  );
}

/** Changes a plan's name, days and total. Its limits stay, so the total cannot drop below them. */
export function updatePlan(
  db: Db,
  planId: number,
  input: PlanInput,
  now: number = Date.now(),
): Promise<PlanResult> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<PlanResult> => {
      await livePlan(tx, planId);
      const plan = resolve(input);
      const problem = planProblem(plan, {
        others: await othersOf(tx, planId),
        limitsTotal: await limitsTotal(tx, planId),
      });
      if (problem !== null) return { ok: false, message: problem };
      await tx.run(
        `UPDATE budget_plans SET name = ?, start_day = ?, end_day = ?, total_pesewas = ?,
           daily_pesewas = ?, updated_at = ? WHERE id = ?`,
        [cleanName(plan.name), plan.startDay, plan.endDay, plan.total, plan.daily, now, planId],
      );
      return { ok: true, id: planId };
    }),
  );
}

/** Sets or replaces one category's limit. The other limits are checked against the room left. */
export function setLimit(db: Db, planId: number, input: LimitInput): Promise<LimitResult> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<LimitResult> => {
      const plan = await livePlan(tx, planId);
      const row = await categoryRowId(tx, input.categoryId);
      if (row === null) return { ok: false, message: 'That category is gone.' };
      const room = plan.total - (await limitsTotal(tx, planId, row));
      const problem = limitProblem(input, room);
      if (problem !== null) return { ok: false, message: problem };
      // Not an upsert: SQLite runs the insert trigger before it resolves the conflict, so the
      // limit being replaced would count twice against the plan total.
      const { changes } = await tx.run(
        'UPDATE budget_limits SET limit_pesewas = ? WHERE plan_id = ? AND category_id = ?',
        [input.amount, planId, row],
      );
      if (changes === 0) await insertLimits(tx, planId, [{ id: row, amount: input.amount }]);
      return { ok: true };
    }),
  );
}

/** Takes a category's limit away. A limit that is already gone is not an error. */
export function removeLimit(db: Db, planId: number, categoryId: string): Promise<void> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      const row = await categoryRowId(tx, categoryId);
      if (row === null) return;
      await tx.run('DELETE FROM budget_limits WHERE plan_id = ? AND category_id = ?', [
        planId,
        row,
      ]);
    }),
  );
}

/** Replaces every limit of a plan at once, for "start from last time". All or nothing. */
export function replaceLimits(
  db: Db,
  planId: number,
  limits: readonly LimitInput[],
): Promise<LimitResult> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<LimitResult> => {
      const plan = await livePlan(tx, planId);
      const rows = await limitRows(tx, limits, plan.total);
      if (typeof rows === 'string') return { ok: false, message: rows };
      await tx.run('DELETE FROM budget_limits WHERE plan_id = ?', [planId]);
      await insertLimits(tx, planId, rows);
      return { ok: true };
    }),
  );
}

/** Removes a plan and its limits. Spending is untouched: it was never stored with the plan. */
export function deletePlan(db: Db, planId: number): Promise<void> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      await tx.run('DELETE FROM budget_limits WHERE plan_id = ?', [planId]);
      await tx.run('DELETE FROM budget_plans WHERE id = ?', [planId]);
    }),
  );
}
