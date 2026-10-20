import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { seedDatabase } from '../seed';
import { openNodeDb } from './nodeDb';

async function setup() {
  const db = openNodeDb();
  await migrate(db, MIGRATIONS);
  await seedDatabase(db, 1_000);
  const food = (await db.get<{ id: number }>(
    `SELECT id FROM categories WHERE system_key = 'food'`,
  ))!.id;
  return { db, food };
}

const smsRow = (categoryId: number, over: Record<string, string | number | null> = {}) => {
  const row = {
    momo_txn_id: 'T1',
    source: 'sms',
    kind: 'payment_out',
    direction: 'out',
    amount_pesewas: 1000,
    fee_pesewas: 0,
    tax_pesewas: 0,
    reference_source: 'sms',
    category_id: categoryId,
    category_source: 'default',
    occurred_at: 1_000,
    occurred_at_source: 'received',
    template_name: 'paid',
    template_version: 1,
    ...over,
  };
  const cols = Object.keys(row);
  return {
    sql: `INSERT INTO transactions (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    params: Object.values(row),
  };
};

describe('schema constraints', () => {
  it('rejects deleting a category that has transactions', async () => {
    const { db, food } = await setup();
    const { sql, params } = smsRow(food);
    await db.run(sql, params);
    await expect(db.run('DELETE FROM categories WHERE id = ?', [food])).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('rejects a transaction pointing at a missing category', async () => {
    const { db } = await setup();
    const { sql, params } = smsRow(9999);
    await expect(db.run(sql, params)).rejects.toThrow(/FOREIGN KEY/);
  });

  it.each([
    ['negative amount', { amount_pesewas: -1 }],
    ['negative fee', { fee_pesewas: -1 }],
    ['bad direction', { direction: 'sideways' }],
    ['bad kind', { kind: 'gift' }],
    ['bad category_source', { category_source: 'guess' }],
    ['sms row without template name', { template_name: null }],
    ['sms row without template version', { template_version: null }],
    ['sms row with a manual: id', { momo_txn_id: 'manual:abc' }],
    ['sms row with user time', { occurred_at_source: 'user' }],
    ['unknown source', { source: 'ussd' }],
  ])('rejects %s', async (_name, over) => {
    const { db, food } = await setup();
    const { sql, params } = smsRow(food, over);
    await expect(db.run(sql, params)).rejects.toThrow(/CHECK/);
  });

  it('accepts a manual row without a template', async () => {
    const { db, food } = await setup();
    const { sql, params } = smsRow(food, {
      momo_txn_id: 'manual:6f1c',
      source: 'manual',
      template_name: null,
      template_version: null,
      occurred_at_source: 'user',
      reference_source: 'user',
      category_source: 'manual',
    });
    await expect(db.run(sql, params)).resolves.toMatchObject({ changes: 1 });
  });

  it('rejects a manual row whose id lacks the manual: prefix', async () => {
    const { db, food } = await setup();
    const { sql, params } = smsRow(food, {
      source: 'manual',
      template_name: null,
      template_version: null,
      occurred_at_source: 'user',
    });
    await expect(db.run(sql, params)).rejects.toThrow(/CHECK/);
  });

  it('keeps keywords normalised and unique across categories', async () => {
    const { db, food } = await setup();
    await db.run(`INSERT INTO keywords (category_id, value) VALUES (?, 'rice')`, [food]);
    await expect(
      db.run(`INSERT INTO keywords (category_id, value) VALUES (?, 'Rice')`, [food]),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.run(`INSERT INTO keywords (category_id, value) VALUES (?, 'rice')`, [food]),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('cascades keywords when a category is deleted', async () => {
    const { db } = await setup();
    const id = (
      await db.run(
        `INSERT INTO categories (name, color, tint, created_at) VALUES ('Pets', '#000', '#fff', 1)`,
      )
    ).lastInsertRowId;
    await db.run(`INSERT INTO keywords (category_id, value) VALUES (?, 'dog food')`, [id]);
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
    expect(await db.get(`SELECT 1 FROM keywords WHERE value = 'dog food'`)).toBeNull();
  });

  it('rejects a user category that claims is_system, or a system_key without it', async () => {
    const { db } = await setup();
    await expect(
      db.run(
        `INSERT INTO categories (name, color, tint, is_system, created_at) VALUES ('X', 'a', 'b', 1, 1)`,
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.run(
        `INSERT INTO categories (name, color, tint, system_key, created_at) VALUES ('Y', 'a', 'b', 'y', 1)`,
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('answers a category spend range from the txn_cat_time index', async () => {
    const { db, food } = await setup();
    const plan = await db.all<{ detail: string }>(
      `EXPLAIN QUERY PLAN
       SELECT SUM(amount_pesewas) FROM transactions
       WHERE category_id = ? AND occurred_at >= ? AND occurred_at < ?`,
      [food, 0, 10_000],
    );
    expect(plan.map((p) => p.detail).join('\n')).toMatch(
      /USING (COVERING )?INDEX txn_cat_time \(category_id=\? AND occurred_at>\? AND occurred_at<\?\)/,
    );
  });
});
