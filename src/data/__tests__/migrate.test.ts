import { migrate, type Migration } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { openNodeDb } from './nodeDb';

const version = async (db: ReturnType<typeof openNodeDb>) =>
  (await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version;

const m = (v: number, sql = `CREATE TABLE t${v} (id INTEGER)`): Migration => ({
  version: v,
  name: `m${v}`,
  sql,
});

describe('migrate', () => {
  it('applies every migration once and advances user_version', async () => {
    const db = openNodeDb();
    expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
    expect(await version(db)).toBe(MIGRATIONS.length);
    const tables = await db.all<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'categories',
        'keywords',
        'meta',
        'name_lists',
        'overrides',
        'recipient_rules',
        'seen_messages',
        'transactions',
      ]),
    );
  });

  it('is idempotent', async () => {
    const db = openNodeDb();
    await migrate(db, MIGRATIONS);
    await expect(migrate(db, MIGRATIONS)).resolves.toBe(MIGRATIONS.length);
  });

  it('applies only the pending tail on an existing database', async () => {
    const db = openNodeDb();
    await migrate(db, [m(1)]);
    await migrate(db, [m(1), m(2)]);
    expect(await version(db)).toBe(2);
  });

  it('rolls back a failing migration and leaves user_version unchanged', async () => {
    const db = openNodeDb();
    await migrate(db, [m(1)]);
    await expect(
      migrate(db, [m(1), m(2, 'CREATE TABLE ok (id INTEGER); NOT SQL')]),
    ).rejects.toThrow();
    expect(await version(db)).toBe(1);
    expect(await db.get(`SELECT 1 FROM sqlite_master WHERE name = 'ok'`)).toBeNull();
  });

  it('tolerates two concurrent migrate calls', async () => {
    const db = openNodeDb();
    await Promise.all([migrate(db, MIGRATIONS), migrate(db, MIGRATIONS)]);
    expect(await version(db)).toBe(MIGRATIONS.length);
  });

  it('throws on gaps and duplicates in numbering', async () => {
    const db = openNodeDb();
    await expect(migrate(db, [m(1), m(3)])).rejects.toThrow(/gaps/);
    await expect(migrate(db, [m(1), m(1)])).rejects.toThrow(/duplicate/);
    await expect(migrate(db, [m(2)])).rejects.toThrow(/gaps/);
    expect(await version(db)).toBe(0);
  });

  it('refuses a database newer than the app', async () => {
    const db = openNodeDb();
    await migrate(db, [m(1), m(2)]);
    await expect(migrate(db, [m(1)])).rejects.toThrow(/newer/);
  });
});
