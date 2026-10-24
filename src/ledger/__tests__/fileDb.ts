import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Db } from '@/data/db';
import { migrate } from '@/data/migrate';
import { MIGRATIONS } from '@/data/migrations';
import { seedDatabase } from '@/data/seed';
import { openNodeDb } from '@/data/__tests__/nodeDb';

/**
 * A database on disk that can be closed and opened again, which is what an app restart does.
 * Whatever a test reads from the second handle was committed, not held in memory.
 */
export async function createFileDb() {
  const dir = mkdtempSync(join(tmpdir(), 'momo-'));
  const path = join(dir, 'test.db');
  let current = openNodeDb(path);
  await migrate(current, MIGRATIONS);
  await seedDatabase(current, 1_000);
  return {
    get db(): Db {
      return current;
    },
    reopen(): Db {
      current.close();
      current = openNodeDb(path);
      return current;
    },
    dispose() {
      current.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
