import { addTxn, categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { budgetView, categoryImpact, listPlans, planLimits } from '@/data/queries';
import {
  type PlanInput,
  createPlan,
  deletePlan,
  removeLimit,
  replaceLimits,
  setLimit,
  updatePlan,
} from '../budgets';
import { createCategory, deleteCategory } from '../categories';
import { createFileDb } from './fileDb';

const NOW = Date.UTC(2026, 10, 5, 9);
const month = { startDay: '2026-11-01', endDay: '2026-11-30', total: 100_000 };
const week = { startDay: '2026-12-01', endDay: '2026-12-07', total: 20_000 };

const created = async (
  db: Db,
  input: PlanInput = month,
  limits: { categoryId: string; amount: number }[] = [],
) => {
  const res = await createPlan(db, input, limits, NOW);
  if (!res.ok) throw new Error(res.message);
  return res.id;
};
const message = (res: { ok: boolean } & { message?: string }) => (res.ok ? null : res.message);

let db: Db;
beforeEach(async () => {
  db = await setup();
});

describe('createPlan', () => {
  it('stores the plan with a trimmed name and its limits', async () => {
    const id = await created(db, { ...month, name: '  November  ' }, [
      { categoryId: 'food', amount: 30_000 },
      { categoryId: 'transport', amount: 10_000 },
    ]);
    expect(await db.get('SELECT * FROM budget_plans WHERE id = ?', [id])).toMatchObject({
      name: 'November',
      start_day: '2026-11-01',
      end_day: '2026-11-30',
      total_pesewas: 100_000,
      created_at: NOW,
      updated_at: NOW,
    });
    expect(await planLimits(db, id)).toEqual([
      { categoryId: 'food', amount: 30_000 },
      { categoryId: 'transport', amount: 10_000 },
    ]);
  });

  it('stores a blank name as NULL', async () => {
    const id = await created(db, { ...month, name: '   ' });
    expect(await db.get('SELECT name FROM budget_plans WHERE id = ?', [id])).toEqual({
      name: null,
    });
  });

  it('refuses with the words the form shows, and writes nothing', async () => {
    await created(db);
    const refuse = async (input: object, limits: { categoryId: string; amount: number }[] = []) =>
      message(await createPlan(db, { ...week, ...input }, limits, NOW));
    expect(await refuse({ endDay: '2026-11-30' })).toBe('A plan cannot end before it starts.');
    expect(await refuse({ total: 0 })).toBe('Enter how much you plan to spend.');
    expect(await refuse({ startDay: '2026-11-30', endDay: '2026-12-02' })).toBe(
      'That overlaps your plan for Sun 1 Nov to Mon 30 Nov.',
    );
    expect(await refuse({}, [{ categoryId: 'food', amount: 20_001 }])).toBe(
      'That is more than the plan has left to give (GHS 200.00).',
    );
    expect(await refuse({}, [{ categoryId: 'nope', amount: 100 }])).toBe('That category is gone.');
    expect(
      await refuse({}, [
        { categoryId: 'food', amount: 100 },
        { categoryId: 'food', amount: 100 },
      ]),
    ).toBe('Each category can have one limit.');
    expect((await listPlans(db)).length).toBe(1);
    expect(await db.get('SELECT 1 FROM budget_limits')).toBeNull();
  });

  it('allows a plan that starts in the past, and counts what was spent since', async () => {
    await addTxn(db, {
      amount_pesewas: 2_500,
      occurred_at: Date.UTC(2026, 10, 2, 12),
      auto_category_id: await categoryId(db, 'food'),
    });
    const id = await created(db);
    expect((await budgetView(db, id, '2026-11-05'))!.total.spent).toBe(2_500);
  });
});

describe('updatePlan', () => {
  it('changes the days, total and name and keeps the limits', async () => {
    const id = await created(db, month, [{ categoryId: 'food', amount: 30_000 }]);
    const res = await updatePlan(
      db,
      id,
      { ...month, endDay: '2026-11-15', total: 50_000, name: 'Half' },
      NOW + 1,
    );
    expect(res).toEqual({ ok: true, id });
    expect(await db.get('SELECT * FROM budget_plans WHERE id = ?', [id])).toMatchObject({
      name: 'Half',
      end_day: '2026-11-15',
      total_pesewas: 50_000,
      created_at: NOW,
      updated_at: NOW + 1,
    });
    expect(await planLimits(db, id)).toHaveLength(1);
  });

  it('will not drop the total under its limits', async () => {
    const id = await created(db, month, [{ categoryId: 'food', amount: 30_000 }]);
    expect(message(await updatePlan(db, id, { ...month, total: 29_999 }, NOW))).toBe(
      'Your category limits add up to GHS 300.00. Raise the total or lower them first.',
    );
  });

  it('may keep its own days, but not move onto another plan', async () => {
    const a = await created(db);
    await created(db, week);
    expect(await updatePlan(db, a, month, NOW)).toEqual({ ok: true, id: a });
    expect(message(await updatePlan(db, a, { ...month, endDay: '2026-12-02' }, NOW))).toMatch(
      /overlaps/,
    );
  });

  it('throws for a plan that is gone', async () => {
    await expect(updatePlan(db, 99, month, NOW)).rejects.toThrow('no plan 99');
  });
});

describe('setLimit and removeLimit', () => {
  it('adds a limit and replaces it', async () => {
    const id = await created(db);
    expect(await setLimit(db, id, { categoryId: 'food', amount: 40_000 })).toEqual({ ok: true });
    expect(await setLimit(db, id, { categoryId: 'food', amount: 25_000 })).toEqual({ ok: true });
    expect(await planLimits(db, id)).toEqual([{ categoryId: 'food', amount: 25_000 }]);
  });

  it('checks against the room left by the other limits, not its own old amount', async () => {
    const id = await created(db);
    await setLimit(db, id, { categoryId: 'food', amount: 60_000 });
    await setLimit(db, id, { categoryId: 'transport', amount: 30_000 });
    expect(await setLimit(db, id, { categoryId: 'food', amount: 70_000 })).toEqual({ ok: true });
    expect(message(await setLimit(db, id, { categoryId: 'food', amount: 70_001 }))).toBe(
      'That is more than the plan has left to give (GHS 700.00).',
    );
    expect(message(await setLimit(db, id, { categoryId: 'health', amount: 1 }))).toBe(
      'The plan has nothing left to give. Raise the total first.',
    );
  });

  it('refuses income, a missing category and a zero amount', async () => {
    const id = await created(db);
    expect(message(await setLimit(db, id, { categoryId: 'income', amount: 100 }))).toBe(
      'Income is not spending, so it takes no limit.',
    );
    expect(message(await setLimit(db, id, { categoryId: 'ghost', amount: 100 }))).toBe(
      'That category is gone.',
    );
    expect(message(await setLimit(db, id, { categoryId: 'food', amount: 0 }))).toBe(
      'Enter an amount above 0.',
    );
  });

  it('removes a limit, and a limit already gone is fine', async () => {
    const id = await created(db, month, [{ categoryId: 'food', amount: 100 }]);
    await removeLimit(db, id, 'food');
    await removeLimit(db, id, 'food');
    await removeLimit(db, id, 'ghost');
    expect(await planLimits(db, id)).toEqual([]);
  });
});

describe('replaceLimits', () => {
  it('swaps every limit at once', async () => {
    const id = await created(db, month, [{ categoryId: 'food', amount: 100 }]);
    const res = await replaceLimits(db, id, [
      { categoryId: 'transport', amount: 500 },
      { categoryId: 'health', amount: 300 },
    ]);
    expect(res).toEqual({ ok: true });
    expect((await planLimits(db, id)).map((l) => l.categoryId)).toEqual(['transport', 'health']);
  });

  it('keeps the old limits when the new set is refused', async () => {
    const id = await created(db, month, [{ categoryId: 'food', amount: 100 }]);
    const res = await replaceLimits(db, id, [
      { categoryId: 'transport', amount: 60_000 },
      { categoryId: 'health', amount: 60_000 },
    ]);
    expect(message(res)).toBe('The limits add up to GHS 1,200.00, which is more than the total.');
    expect(await planLimits(db, id)).toEqual([{ categoryId: 'food', amount: 100 }]);
  });
});

describe('deletePlan', () => {
  it('removes the plan and its limits and leaves spending alone', async () => {
    const id = await created(db, month, [{ categoryId: 'food', amount: 100 }]);
    await addTxn(db, { amount_pesewas: 900, occurred_at: Date.UTC(2026, 10, 3) });
    await deletePlan(db, id);
    await deletePlan(db, id);
    expect(await listPlans(db)).toEqual([]);
    expect(await db.get('SELECT 1 FROM budget_limits')).toBeNull();
    expect(await db.get('SELECT 1 FROM transactions')).not.toBeNull();
  });

  it('lets a new plan take the days', async () => {
    const id = await created(db);
    await deletePlan(db, id);
    await created(db);
  });
});

describe('deleting a category', () => {
  it('removes its limits, which the confirmation counted', async () => {
    const made = await createCategory(db, { name: 'Pets', color: '#336699' }, NOW);
    if (!made.ok) throw new Error('create failed');
    const id = await created(db, month, [
      { categoryId: made.id, amount: 500 },
      { categoryId: 'food', amount: 700 },
    ]);
    expect((await categoryImpact(db, made.id))?.budgets).toBe(1);
    await deleteCategory(db, made.id);
    expect(await planLimits(db, id)).toEqual([{ categoryId: 'food', amount: 700 }]);
  });
});

describe('across a restart', () => {
  it('keeps a plan, its limits and their changes', async () => {
    const file = await createFileDb();
    try {
      const id = await created(file.db, month, [{ categoryId: 'food', amount: 30_000 }]);
      await setLimit(file.db, id, { categoryId: 'transport', amount: 5_000 });
      await updatePlan(file.db, id, { ...month, name: 'Kept' }, NOW);
      const reopened = file.reopen();
      expect((await listPlans(reopened)).map((p) => [p.id, p.name, p.total])).toEqual([
        [id, 'Kept', 100_000],
      ]);
      expect(await planLimits(reopened, id)).toEqual([
        { categoryId: 'food', amount: 30_000 },
        { categoryId: 'transport', amount: 5_000 },
      ]);
    } finally {
      file.dispose();
    }
  });
});
