import { SEED_CATEGORIES } from '@/domain/category/seed';
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

  it('matches the UI order in sort_order', async () => {
    const db = await migrated();
    await seedDatabase(db);
    const keys = (
      await db.all<{ system_key: string }>(
        `SELECT system_key FROM categories WHERE system_key NOT IN ('cash','misc') ORDER BY sort_order`,
      )
    ).map((r) => r.system_key);
    expect(keys).toEqual(SEED_CATEGORIES.map((c) => c.id).filter((id) => id !== 'other'));
  });

  it('seeds no keywords', async () => {
    const db = await migrated();
    await seedDatabase(db);
    expect(await db.get('SELECT 1 FROM keywords')).toBeNull();
  });

  it('fails loudly when a user category already holds a seed name', async () => {
    const db = await migrated();
    await db.run(
      `INSERT INTO categories (name, color, tint, created_at, updated_at) VALUES ('food', '#000000', '#000000', 1, 1)`,
    );
    await expect(seedDatabase(db)).rejects.toThrow(/UNIQUE/);
  });
});
