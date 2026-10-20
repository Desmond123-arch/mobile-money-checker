import { SEED_CATEGORIES } from '@/domain/category/seed';
import type { Db } from './db';

export const SEED_VERSION = 1;

export interface SeedCategory {
  systemKey: string;
  name: string;
  color: string;
  tint: string;
}

// categorisation.md retires "Other" in favour of "Misc" and resolves rule 6 and the Paystack
// default by system_key, so the UI's `other` becomes `misc` here. Every other UI id is already a valid key.
const UI_ID_TO_SYSTEM_KEY: Readonly<Record<string, string>> = { other: 'misc' };
const RENAMED: Readonly<Record<string, string>> = { misc: 'Misc' };

// Cash is a system category the UI seed lacks: cash-outs stay in it until the user says what they were for.
const CASH: SeedCategory = { systemKey: 'cash', name: 'Cash', color: '#5B6B7A', tint: '#E4E8EC' };

export const SYSTEM_CATEGORIES: readonly SeedCategory[] = [
  ...SEED_CATEGORIES.map((c) => {
    const systemKey = UI_ID_TO_SYSTEM_KEY[c.id] ?? c.id;
    return { systemKey, name: RENAMED[systemKey] ?? c.name, color: c.color, tint: c.tint };
  }),
  CASH,
];

export async function seedDatabase(db: Db, now: number = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    // ON CONFLICT(system_key) rather than OR IGNORE: a user category already named "Cash" must fail loudly, not silently drop the system row.
    // Array order fixes `sort` and, on a fresh database, the integer ids, so they are stable across installs.
    for (const [i, c] of SYSTEM_CATEGORIES.entries()) {
      await tx.run(
        `INSERT INTO categories (name, color, tint, system_key, is_system, sort, created_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(system_key) DO NOTHING`,
        [c.name, c.color, c.tint, c.systemKey, i, now],
      );
    }
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('seed_version', ?)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(SEED_VERSION)],
    );
  });
}
