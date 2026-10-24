import { SEED_CATEGORIES } from '@/domain/category/seed';
import { KEYWORD_CATEGORY_ORDER, SEED_KEYWORDS } from '@/domain/categorise/seed';
import { SEED_VERSION, seedDatabase } from '../seed';
import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { openNodeDb } from './nodeDb';

const migrated = async () => {
  const db = openNodeDb();
  await migrate(db, MIGRATIONS);
  return db;
};

describe('migration 0001 categories', () => {
  it('inserts exactly the five protected categories, Cash as #444444', async () => {
    const db = await migrated();
    const rows = await db.all<{ system_key: string; color: string; seed_version: number }>(
      'SELECT system_key, color, seed_version FROM categories ORDER BY sort_order',
    );
    expect(rows.map((r) => r.system_key)).toEqual(['family', 'friends', 'income', 'cash', 'misc']);
    expect(rows.find((r) => r.system_key === 'cash')?.color).toBe('#444444');
    expect(rows.every((r) => r.seed_version === 1)).toBe(true);
  });
});

describe('seedDatabase', () => {
  it('adds the other UI categories keyed by UI id, and maps UI "other" to the Misc row', async () => {
    const db = await migrated();
    await seedDatabase(db, 5);
    const keys = (await db.all<{ system_key: string }>('SELECT system_key FROM categories')).map(
      (r) => r.system_key,
    );
    expect(keys).toHaveLength(SEED_CATEGORIES.length + 1);
    expect(new Set(keys)).toEqual(
      new Set([...SEED_CATEGORIES.map((c) => c.id).filter((id) => id !== 'other'), 'misc', 'cash']),
    );
    expect(await db.get(`SELECT 1 FROM categories WHERE name = 'Other'`)).toBeNull();
    expect(await db.get(`SELECT value FROM meta WHERE key = 'seed_version'`)).toEqual({
      value: String(SEED_VERSION),
    });
  });

  it('is idempotent and keeps ids stable', async () => {
    const db = await migrated();
    await seedDatabase(db, 1);
    const first = await db.all('SELECT * FROM categories ORDER BY id');
    await seedDatabase(db, 2);
    expect(await db.all('SELECT * FROM categories ORDER BY id')).toEqual(first);
  });

  it('does not bring back a seeded category the user deleted', async () => {
    const db = await migrated();
    await seedDatabase(db);
    await db.run(`DELETE FROM categories WHERE system_key = 'shopping'`);
    await seedDatabase(db);
    expect(await db.get(`SELECT 1 FROM categories WHERE system_key = 'shopping'`)).toBeNull();
  });

  it('orders the keyword categories by the categorisation priority in sort_order', async () => {
    const db = await migrated();
    await seedDatabase(db);
    const keys = (
      await db.all<{ system_key: string }>(
        `SELECT system_key FROM categories WHERE sort_order >= 200 AND system_key <> 'cash' AND system_key <> 'misc' ORDER BY sort_order`,
      )
    ).map((r) => r.system_key);
    expect(keys).toEqual(KEYWORD_CATEGORY_ORDER);
  });

  it('gives every categorisation.md category a row', async () => {
    const db = await migrated();
    await seedDatabase(db);
    const names = (await db.all<{ name: string }>('SELECT name FROM categories')).map(
      (r) => r.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'Electronics',
        'Entertainment & Subscriptions',
        'Personal Care',
        'Giving',
        'Savings & Investing',
        'Services',
        'Health',
        'Education',
      ]),
    );
    expect(names).not.toContain('Other');
    expect(names).not.toContain('Self');
  });
});

describe('seeded keywords', () => {
  const total = SEED_KEYWORDS.reduce((n, s) => n + s.words.length + (s.aliases?.length ?? 0), 0);

  it('inserts every seed word once, mapped to its category, as origin seed', async () => {
    const db = await migrated();
    await seedDatabase(db);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM keywords'))!.n).toBe(total);
    expect(
      await db.get(
        `SELECT c.system_key, k.origin, k.is_alias FROM keywords k JOIN categories c ON c.id = k.category_id WHERE k.value = 'waakye'`,
      ),
    ).toEqual({ system_key: 'food', origin: 'seed', is_alias: 0 });
    expect(
      (await db.get<{ is_alias: number }>(`SELECT is_alias FROM keywords WHERE value = 'wayer'`))!
        .is_alias,
    ).toBe(1);
  });

  it('does not re-add a word the user deleted, or run twice', async () => {
    const db = await migrated();
    await seedDatabase(db);
    await db.run(`DELETE FROM keywords WHERE value = 'rice'`);
    await seedDatabase(db);
    expect(await db.get(`SELECT 1 FROM keywords WHERE value = 'rice'`)).toBeNull();
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM keywords'))!.n).toBe(total - 1);
  });

  it('upgrades a database that only has seed version 1', async () => {
    const db = await migrated();
    await seedDatabase(db);
    await db.run(`DELETE FROM keywords`);
    await db.run(`UPDATE meta SET value = '1' WHERE key = 'seed_version'`);
    await db.run(
      `INSERT INTO keywords (category_id, value, is_alias, origin, created_at)
       VALUES ((SELECT id FROM categories WHERE system_key = 'shopping'), 'rice', 0, 'user', 1)`,
    );
    await seedDatabase(db);
    const rice = await db.get<{ k: string; origin: string }>(
      `SELECT c.system_key AS k, origin FROM keywords JOIN categories c ON c.id = category_id WHERE value = 'rice'`,
    );
    expect(rice).toEqual({ k: 'shopping', origin: 'user' });
  });

  it('skips the words of a category the user deleted', async () => {
    const db = await migrated();
    await seedDatabase(db, 1);
    await db.run(`UPDATE meta SET value = '1' WHERE key = 'seed_version'`);
    await db.run(`DELETE FROM categories WHERE system_key = 'shopping'`);
    await seedDatabase(db);
    expect(await db.get(`SELECT 1 FROM keywords WHERE value = 'jumia'`)).toBeNull();
  });
});

describe('seed failure', () => {
  it('fails loudly when a user category already holds a seed name', async () => {
    const db = await migrated();
    await db.run(
      `INSERT INTO categories (name, color, tint, created_at, updated_at) VALUES ('food', '#000000', '#000000', 1, 1)`,
    );
    await expect(seedDatabase(db)).rejects.toThrow(/UNIQUE/);
  });
});
