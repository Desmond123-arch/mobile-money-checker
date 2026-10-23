import { addLink, addTxn, categoryId, setup, sum } from './fixtures';
import type { Db } from '../db';
import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';
import {
  budgetHistory,
  budgetPlan,
  budgetView,
  categoryImpact,
  listPlans,
  planLimits,
} from '../queries';
import { planRange } from '@/domain/budget/plan';

const DAY = 86_400_000;
const at = (iso: string, ms = 0) => Date.parse(`${iso}T00:00:00Z`) + ms;

let db: Db;
beforeEach(async () => {
  db = await setup();
});

const plan = async (over: Record<string, string | number | null> = {}) =>
  (
    await db.run(
      `INSERT INTO budget_plans (name, start_day, end_day, total_pesewas, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 1)`,
      [
        (over.name as string | null) ?? null,
        (over.start as string) ?? '2026-11-01',
        (over.end as string) ?? '2026-11-10',
        (over.total as number) ?? 100_000,
      ],
    )
  ).lastInsertRowId;

const limit = async (planId: number, key: string, pesewas: number) =>
  db.run('INSERT INTO budget_limits (plan_id, category_id, limit_pesewas) VALUES (?, ?, ?)', [
    planId,
    await categoryId(db, key),
    pesewas,
  ]);

describe('migration 0003', () => {
  it('is the third migration and applies once', async () => {
    expect(MIGRATIONS.map((m) => m.name)).toEqual(['init', 'cash_allocations', 'budgets']);
    await migrate(db, MIGRATIONS);
    expect((await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(3);
    expect(await db.all('SELECT * FROM budget_plans')).toEqual([]);
  });

  it('upgrades a database that was at 0002 without touching its ledger', async () => {
    const old = await setup();
    await old.exec('DROP TABLE budget_limits; DROP TABLE budget_plans; PRAGMA user_version = 2');
    const before = await old.all('SELECT * FROM ledger_lines');
    await migrate(old, MIGRATIONS);
    expect(await old.all('SELECT * FROM ledger_lines')).toEqual(before);
    expect(
      await old.get('SELECT 1 FROM sqlite_master WHERE name = ?', ['budget_plans']),
    ).not.toBeNull();
  });
});

describe('budget_plans rules', () => {
  it('needs real days, an end that is not before the start, and a positive total', async () => {
    await expect(plan({ start: '2026-11-10', end: '2026-11-09' })).rejects.toThrow(/CHECK/);
    await expect(plan({ start: 'nov 1' })).rejects.toThrow(/CHECK/);
    await expect(plan({ total: 0 })).rejects.toThrow(/CHECK/);
    await expect(plan({ name: ' padded ' })).rejects.toThrow(/CHECK/);
    await expect(plan({ name: '' })).rejects.toThrow(/CHECK/);
    await expect(plan({ start: '2026-11-05', end: '2026-11-05' })).resolves.toBeGreaterThan(0);
  });

  it('refuses plans that share a day, on insert and on update', async () => {
    const first = await plan({ start: '2026-11-01', end: '2026-11-10' });
    await expect(plan({ start: '2026-11-10', end: '2026-11-12' })).rejects.toThrow(/overlap/);
    await expect(plan({ start: '2026-10-25', end: '2026-11-01' })).rejects.toThrow(/overlap/);
    const second = await plan({ start: '2026-11-11', end: '2026-11-20' });
    await expect(
      db.run(`UPDATE budget_plans SET start_day = '2026-11-10' WHERE id = ?`, [second]),
    ).rejects.toThrow(/overlap/);
    await expect(
      db.run(`UPDATE budget_plans SET end_day = '2026-11-12' WHERE id = ?`, [first]),
    ).rejects.toThrow(/overlap/);
    await db.run(`UPDATE budget_plans SET name = 'Rent' WHERE id = ?`, [first]);
    await db.run(`UPDATE budget_plans SET end_day = '2026-11-09' WHERE id = ?`, [first]);
  });
});

describe('budget_limits rules', () => {
  it('holds the limits to the plan total on insert, on update and when the total drops', async () => {
    const id = await plan({ total: 10_000 });
    await limit(id, 'food', 6_000);
    await expect(limit(id, 'transport', 4_001)).rejects.toThrow(/exceed/);
    await limit(id, 'transport', 4_000);
    await expect(
      db.run(
        'UPDATE budget_limits SET limit_pesewas = 6_001 WHERE plan_id = ? AND category_id = ?',
        [id, await categoryId(db, 'food')],
      ),
    ).rejects.toThrow(/exceed/);
    await expect(
      db.run('UPDATE budget_plans SET total_pesewas = 9_999 WHERE id = ?', [id]),
    ).rejects.toThrow(/exceed/);
    await db.run('UPDATE budget_plans SET total_pesewas = 10_000 WHERE id = ?', [id]);
  });

  it('has one limit per category and no limit on income', async () => {
    const id = await plan();
    await limit(id, 'food', 100);
    await expect(limit(id, 'food', 100)).rejects.toThrow(/UNIQUE|PRIMARY/);
    await expect(limit(id, 'income', 100)).rejects.toThrow(/income/);
    await expect(limit(id, 'misc', 0)).rejects.toThrow(/CHECK/);
  });

  it('goes with its plan', async () => {
    const id = await plan();
    await limit(id, 'food', 100);
    await db.run('DELETE FROM budget_plans WHERE id = ?', [id]);
    expect(await db.get('SELECT 1 FROM budget_limits')).toBeNull();
    expect(await db.get('PRAGMA foreign_key_check')).toBeNull();
  });
});

describe('spending over a plan', () => {
  it('counts the first and last day whole and nothing outside them', async () => {
    const id = await plan({ start: '2026-11-01', end: '2026-11-03' });
    const food = await categoryId(db, 'food');
    const put = (ms: number, pesewas: number) =>
      addTxn(db, { amount_pesewas: pesewas, occurred_at: ms, auto_category_id: food });
    await put(at('2026-10-31', DAY - 1), 7);
    await put(at('2026-11-01'), 100);
    await put(at('2026-11-03', DAY - 1), 200);
    await put(at('2026-11-04'), 9);

    const row = (await budgetPlan(db, id))!;
    expect(row.spent).toBe(300);
    const range = planRange('2026-11-01', '2026-11-03');
    expect(row.spent).toBe(
      await sum(db, `bucket = 'spend' AND at >= ? AND at < ?`, [range.start, range.end]),
    );
  });

  it('nets a refund into the month of its original, not the month it arrived', async () => {
    const id = await plan({ start: '2026-11-01', end: '2026-11-10' });
    const original = await addTxn(db, {
      amount_pesewas: 1_000,
      occurred_at: at('2026-11-02'),
      auto_category_id: await categoryId(db, 'food'),
    });
    const credit = await addTxn(db, {
      flow: 'credit',
      kind: 'refund',
      amount_pesewas: 400,
      occurred_at: at('2026-12-20'),
    });
    await addLink(db, credit, original);
    expect((await budgetPlan(db, id))!.spent).toBe(600);
  });

  it('lists plans latest first, each with its own spend', async () => {
    const a = await plan({ start: '2026-10-01', end: '2026-10-31' });
    const b = await plan({ start: '2026-11-01', end: '2026-11-30' });
    await addTxn(db, { amount_pesewas: 50, occurred_at: at('2026-10-15') });
    await addTxn(db, { amount_pesewas: 70, occurred_at: at('2026-11-15') });
    const plans = await listPlans(db);
    expect(plans.map((p) => [p.id, p.spent])).toEqual([
      [b, 70],
      [a, 50],
    ]);
    expect(plans[0]).toMatchObject({
      startDay: '2026-11-01',
      endDay: '2026-11-30',
      total: 100_000,
    });
    expect(await budgetPlan(db, 999)).toBeNull();
  });
});

describe('planLimits and budgetView', () => {
  it('returns UI category ids, biggest limit first', async () => {
    const id = await plan();
    await limit(id, 'food', 2_000);
    await limit(id, 'misc', 5_000);
    await db.run(
      `INSERT INTO categories (name, color, tint, sort_order, created_at, updated_at)
       VALUES ('Pets', '#112233', '#EEEEFF', 400, 1, 1)`,
    );
    const pets = (await db.get<{ id: number }>(`SELECT id FROM categories WHERE name = 'Pets'`))!
      .id;
    await db.run('INSERT INTO budget_limits VALUES (?, ?, 1_000)', [id, pets]);
    expect((await planLimits(db, id)).map((l) => l.categoryId)).toEqual([
      'other',
      'food',
      String(pets),
    ]);
  });

  it('measures each limit and the whole plan', async () => {
    const id = await plan({ start: '2026-11-01', end: '2026-11-10', total: 100_000 });
    await limit(id, 'food', 40_000);
    const food = await categoryId(db, 'food');
    const transport = await categoryId(db, 'transport');
    await addTxn(db, {
      amount_pesewas: 36_000,
      occurred_at: at('2026-11-03'),
      auto_category_id: food,
    });
    await addTxn(db, {
      amount_pesewas: 7_000,
      occurred_at: at('2026-11-04'),
      auto_category_id: transport,
    });
    const view = (await budgetView(db, id, '2026-11-05'))!;
    expect(view.total).toMatchObject({ spent: 43_000, left: 57_000 });
    expect(view.categories).toHaveLength(1);
    expect(view.categories[0]).toMatchObject({ categoryId: 'food' });
    expect(view.categories[0]?.progress).toMatchObject({ spent: 36_000, tone: 'watch' });
    expect(view.rest).toMatchObject({ limit: 60_000, spent: 7_000 });
    expect(view.pace).toMatchObject({ dayNumber: 5, daysLeft: 6 });
    expect(await budgetView(db, 999, '2026-11-05')).toBeNull();
  });

  it('follows a category tag change without any budget write', async () => {
    const id = await plan();
    await limit(id, 'food', 40_000);
    const tx = await addTxn(db, { amount_pesewas: 5_000, occurred_at: at('2026-11-03') });
    expect((await budgetView(db, id, '2026-11-05'))!.categories[0]?.progress.spent).toBe(0);
    await db.run(
      'INSERT INTO transaction_annotations (transaction_id, category_id, updated_at) VALUES (?, ?, 1)',
      [tx, await categoryId(db, 'food')],
    );
    expect((await budgetView(db, id, '2026-11-05'))!.categories[0]?.progress.spent).toBe(5_000);
  });
});

describe('budgetHistory', () => {
  it('reads the same number of days right before the start', async () => {
    const food = await categoryId(db, 'food');
    await addTxn(db, {
      amount_pesewas: 300,
      occurred_at: at('2026-10-25'),
      auto_category_id: food,
    });
    await addTxn(db, {
      amount_pesewas: 900,
      occurred_at: at('2026-10-24', DAY - 1),
      auto_category_id: food,
    });
    await addTxn(db, {
      amount_pesewas: 800,
      occurred_at: at('2026-11-01'),
      auto_category_id: food,
    });
    const history = await budgetHistory(db, '2026-11-01', 7);
    expect(history.days).toBe(7);
    expect(history.spend).toEqual([{ categoryId: 'food', amount: 300 }]);
  });
});

describe('categoryImpact', () => {
  it('counts the budget limits a category delete would remove', async () => {
    const id = await plan();
    await limit(id, 'food', 100);
    expect((await categoryImpact(db, 'food'))?.budgets).toBe(1);
    expect((await categoryImpact(db, 'transport'))?.budgets).toBe(0);
  });
});
