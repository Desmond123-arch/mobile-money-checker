import type { Db } from '@/data/db';
import { UI_CATEGORY_ID_SQL } from '@/data/queries/sql';

/** The `categories.id` behind a UI category id (`food`, `other`, `12`), or null if there is none. */
export async function categoryRowId(tx: Db, uiId: string): Promise<number | null> {
  const row = await tx.get<{ id: number }>(
    `SELECT c.id FROM categories c WHERE ${UI_CATEGORY_ID_SQL} = ?`,
    [uiId],
  );
  return row?.id ?? null;
}

export async function requireCategoryRowId(tx: Db, uiId: string): Promise<number> {
  const id = await categoryRowId(tx, uiId);
  if (id === null) throw new Error(`no category ${uiId}`);
  return id;
}
