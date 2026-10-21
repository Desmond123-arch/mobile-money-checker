import { SEED_CATEGORIES } from '@/domain/category/seed';
import { KEYWORD_CATEGORY_ORDER, SEED_KEYWORDS } from '@/domain/categorise/seed';
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
  /** New sort_order for categories earlier steps inserted. */
  resort?: Readonly<Record<string, number>>;
  keywords?: readonly { systemKey: string; value: string; isAlias: boolean }[];
}

const V1_IDS: ReadonlySet<string> = new Set([
  'food',
  'rent',
  'transport',
  'airtime',
  'shopping',
  'health',
  'education',
]);

// docs/categorisation.md orders the keyword categories; sort_order is also the tie-break priority.
const keywordSort = (systemKey: string) =>
  200 + SORT_STEP * KEYWORD_CATEGORY_ORDER.indexOf(systemKey);

// A step lists only what version N introduced. Rows the user deleted are never re-added
// because a step runs once, when meta.seed_version is below its version.
export const SEED_STEPS: readonly SeedStep[] = [
  {
    version: 1,
    categories: SEED_CATEGORIES.flatMap((c, i) =>
      V1_IDS.has(c.id)
        ? [
            {
              systemKey: c.id,
              name: c.name,
              color: c.color,
              tint: c.tint,
              sort: (i + 1) * SORT_STEP,
            },
          ]
        : [],
    ),
  },
  {
    version: 2,
    categories: SEED_CATEGORIES.filter((c) => !V1_IDS.has(c.id) && !IN_MIGRATION.has(c.id)).map(
      (c) => ({
        systemKey: c.id,
        name: c.name,
        color: c.color,
        tint: c.tint,
        sort: keywordSort(c.id),
      }),
    ),
    resort: Object.fromEntries(KEYWORD_CATEGORY_ORDER.map((k) => [k, keywordSort(k)])),
    keywords: SEED_KEYWORDS.flatMap((set) => [
      ...set.words.map((value) => ({ systemKey: set.systemKey, value, isAlias: false })),
      ...(set.aliases ?? []).map((value) => ({ systemKey: set.systemKey, value, isAlias: true })),
    ]),
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
      for (const [systemKey, sort] of Object.entries(step.resort ?? {})) {
        await tx.run('UPDATE categories SET sort_order = ? WHERE system_key = ?', [
          sort,
          systemKey,
        ]);
      }
      for (const k of step.keywords ?? []) {
        // A word the user already added keeps its owner; a category the user deleted gets no words.
        await tx.run(
          `INSERT INTO keywords (category_id, value, is_alias, origin, created_at)
           SELECT id, ?, ?, 'seed', ? FROM categories WHERE system_key = ?
           ON CONFLICT(value) DO NOTHING`,
          [k.value, k.isAlias ? 1 : 0, now, k.systemKey],
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
