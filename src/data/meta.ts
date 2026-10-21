import type { Db } from './db';

export type MetaKey =
  | 'first_import_done'
  | 'first_import_at'
  | 'last_import_at'
  | 'onboarding_choice'
  | 'parser_version'
  | 'seed_version';

export const getMeta = async (db: Db, key: MetaKey): Promise<string | null> =>
  (await db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]))?.value ?? null;

export const setMeta = async (db: Db, key: MetaKey, value: string): Promise<void> => {
  await db.run(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
};
