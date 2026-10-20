import type { Db } from './db';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

function assertContiguous(migrations: readonly Migration[]): Migration[] {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((m, i) => {
    if (m.version === sorted[i - 1]?.version) {
      throw new Error(`duplicate migration version ${m.version}`);
    }
    if (m.version !== i + 1) {
      throw new Error(
        `migration versions must run 1..n without gaps, found ${m.version} at position ${i + 1}`,
      );
    }
  });
  return sorted;
}

async function currentVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrate(db: Db, migrations: readonly Migration[]): Promise<number> {
  const ordered = assertContiguous(migrations);
  const latest = ordered.length;
  const before = await currentVersion(db);
  if (before > latest) {
    throw new Error(`database is at version ${before}, newer than this app's ${latest}`);
  }
  for (const m of ordered.slice(before)) {
    await db.transaction(async (tx) => {
      // Re-read inside the lock: a concurrent migrate may have applied this one while we waited.
      if ((await currentVersion(tx)) >= m.version) return;
      await tx.exec(m.sql);
      // user_version is a header field written in the same transaction, so a failed migration leaves it unchanged.
      await tx.exec(`PRAGMA user_version = ${m.version}`);
    });
  }
  return latest;
}
