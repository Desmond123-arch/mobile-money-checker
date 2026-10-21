import { addLink, addTxn, categoryId, month, setup, sum } from './fixtures';
import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';

// The budgets sketch, applied after every shipped migration from docs/data-model.md. If 0001 changes in a way that breaks it, this fails.
const BUDGETS_SQL = `
CREATE TABLE budgets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL CHECK (effective_from GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  limit_pesewas  INTEGER NOT NULL CHECK (limit_pesewas >= 0),
  rollover       INTEGER NOT NULL DEFAULT 0 CHECK (rollover IN (0,1)),
  created_at     INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX budgets_category_from ON budgets(category_id, effective_from) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX budgets_overall_from  ON budgets(effective_from) WHERE category_id IS NULL;
CREATE TABLE budget_alerts (
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  month TEXT NOT NULL, threshold_pct INTEGER NOT NULL, fired_at INTEGER NOT NULL,
  PRIMARY KEY (budget_id, month, threshold_pct)
) STRICT;
`;

describe('budgets as the next migration', () => {
  it('applies on top of 0001 and sums category-month spend over ledger_lines', async () => {
    const db = await setup();
    await migrate(db, [
      ...MIGRATIONS,
      { version: MIGRATIONS.length + 1, name: 'budgets', sql: BUDGETS_SQL },
    ]);
    const food = await categoryId(db, 'food');
    const m = month(3);
    await db.run(
      `INSERT INTO budgets (category_id, effective_from, limit_pesewas, created_at) VALUES (?, '2026-10', 5000, 1)`,
      [food],
    );
    await expect(
      db.run(
        `INSERT INTO budgets (category_id, effective_from, limit_pesewas, created_at) VALUES (?, '2026-10', 1, 1)`,
        [food],
      ),
    ).rejects.toThrow(/UNIQUE/);
    await db.run(
      `INSERT INTO budgets (effective_from, limit_pesewas, created_at) VALUES ('2026-10', 9000, 1)`,
    );
    await expect(
      db.run(
        `INSERT INTO budgets (effective_from, limit_pesewas, created_at) VALUES ('2026-10', 1, 1)`,
      ),
    ).rejects.toThrow(/UNIQUE/);

    const original = await addTxn(db, {
      amount_pesewas: 2000,
      fee_pesewas: 30,
      occurred_at: m.start,
      auto_category_id: food,
    });
    const credit = await addTxn(db, {
      flow: 'credit',
      kind: 'refund',
      amount_pesewas: 500,
      occurred_at: m.end + 1,
    });
    await addLink(db, credit, original);
    await addTxn(db, { amount_pesewas: 999, occurred_at: m.end, auto_category_id: food });

    const spent = await sum(db, `bucket = 'spend' AND category_id = ? AND at >= ? AND at < ?`, [
      food,
      m.start,
      m.end,
    ]);
    expect(spent).toBe(1530);

    await db.run('DELETE FROM budgets WHERE category_id = ?', [food]);
    expect(await db.get('SELECT 1 FROM budget_alerts')).toBeNull();
    expect(await db.get<{ c: number }>('PRAGMA foreign_key_check')).toBeNull();
  });
});
