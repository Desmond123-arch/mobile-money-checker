import { SEED_CATEGORIES } from '@/domain/category/seed';
import type { Db } from './db';

// Categories the migration already inserts (they are protected). UI `other` is the migration's misc row.
const IN_MIGRATION: ReadonlySet<string> = new Set(['family', 'friends', 'income', 'other']);

// Position in the UI list, so the migration's sort_order for family/friends/income and these agree.
const SORT_STEP = 10;

export interface SeedStep {
  version: number;
  categories: readonly {
    systemKey: string;
    name: string;
    color: string;
    tint: string;
    sort: number;
  }[];
}

// A step lists only what version N introduced. Rows the user deleted are never re-added
// because a step runs once, when meta.seed_version is below its version.
export const SEED_STEPS: readonly SeedStep[] = [
  {
    version: 1,
    categories: SEED_CATEGORIES.flatMap((c, i) =>
      IN_MIGRATION.has(c.id)
        ? []
        : [
            {
              systemKey: c.id,
              name: c.name,
              color: c.color,
              tint: c.tint,
              sort: (i + 1) * SORT_STEP,
            },
          ],
    ),
  },
];

export const SEED_VERSION = SEED_STEPS[SEED_STEPS.length - 1]!.version;

export async function seedDatabase(db: Db, now: number = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx.get<{ value: string }>(
      `SELECT value FROM meta WHERE key = 'seed_version'`,
    );
    const applied = row ? Number(row.value) : 0;
    for (const step of SEED_STEPS.filter((s) => s.version > applied)) {
      for (const c of step.categories) {
        // ON CONFLICT(system_key), not OR IGNORE: a user category named "Food" must fail loudly on the name constraint.
        await tx.run(
          `INSERT INTO categories (system_key, name, color, tint, sort_order, seed_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(system_key) DO NOTHING`,
          [c.systemKey, c.name, c.color, c.tint, c.sort, step.version, now, now],
        );
      }
    }
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('seed_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(SEED_VERSION)],
    );
  });
}
