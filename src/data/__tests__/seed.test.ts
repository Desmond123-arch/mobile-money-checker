import { SEED_CATEGORIES } from '@/domain/category/seed';
import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { SEED_VERSION, SYSTEM_CATEGORIES, seedDatabase } from '../seed';
import { openNodeDb } from './nodeDb';

async function fresh() {
  const db = openNodeDb();
  await migrate(db, MIGRATIONS);
  return db;
}

describe('seedDatabase', () => {
  it('is idempotent and keeps ids stable', async () => {
    const db = await fresh();
    await seedDatabase(db, 1);
    const first = await db.all('SELECT * FROM categories ORDER BY id');
    await seedDatabase(db, 2);
    expect(await db.all('SELECT * FROM categories ORDER BY id')).toEqual(first);
    expect(first).toHaveLength(SYSTEM_CATEGORIES.length);
    expect(await db.get(`SELECT value FROM meta WHERE key = 'seed_version'`)).toEqual({
      value: String(SEED_VERSION),
    });
  });

  it('gives every category a unique system_key and marks it as system', async () => {
    const db = await fresh();
    await seedDatabase(db);
    const rows = await db.all<{ system_key: string; is_system: number }>(
      'SELECT system_key, is_system FROM categories',
    );
    expect(new Set(rows.map((r) => r.system_key)).size).toBe(rows.length);
    expect(rows.every((r) => r.is_system === 1)).toBe(true);
  });

  it('includes Cash and Misc, and maps the UI "other" to Misc', async () => {
    const db = await fresh();
    await seedDatabase(db);
    const keys = (await db.all<{ system_key: string }>('SELECT system_key FROM categories')).map(
      (r) => r.system_key,
    );
    expect(keys).toEqual(expect.arrayContaining(['cash', 'misc', 'income', 'family', 'friends']));
    expect(keys).not.toContain('other');
    expect(
      await db.get<{ name: string }>(`SELECT name FROM categories WHERE system_key = 'misc'`),
    ).toEqual({ name: 'Misc' });
  });

  it('covers every UI seed category', () => {
    expect(SYSTEM_CATEGORIES.length).toBe(SEED_CATEGORIES.length + 1);
  });

  it('does not seed keywords yet', async () => {
    const db = await fresh();
    await seedDatabase(db);
    expect(await db.get('SELECT 1 FROM keywords')).toBeNull();
  });

  it('fails loudly when a user category already holds a system name', async () => {
    const db = await fresh();
    await db.run(
      `INSERT INTO categories (name, color, tint, created_at) VALUES ('cash', 'a', 'b', 1)`,
    );
    await expect(seedDatabase(db)).rejects.toThrow(/UNIQUE/);
  });
});
