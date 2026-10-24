import type { Db } from '../db';
import type { TimeRange } from '@/domain/calendar/month';
import type { Category } from '@/domain/category/category';
import type { CategorySpend } from '@/domain/category/share';
import { pesewas } from '@/domain/money';

import { inRange, UI_CATEGORY_ID_SQL } from './sql';

/** Every category in display order, with the UI ids described in `uiCategoryId`. */
export async function listCategories(db: Db): Promise<Category[]> {
  return db.all<Category>(
    `SELECT ${UI_CATEGORY_ID_SQL} AS id, c.name, c.color, c.tint
     FROM categories c ORDER BY c.sort_order, c.id`,
  );
}

/** Net spend per effective category in the range, largest first; categories that net to zero or less are left out. */
export async function categorySpend(db: Db, range: TimeRange): Promise<CategorySpend[]> {
  const time = inRange('l.at', range);
  const rows = await db.all<{ category_id: string; amount: number }>(
    `SELECT ${UI_CATEGORY_ID_SQL} AS category_id, SUM(l.pesewas) AS amount
     FROM ledger_lines l JOIN categories c ON c.id = l.category_id
     WHERE l.bucket = 'spend' AND ${time.sql}
     GROUP BY c.id HAVING SUM(l.pesewas) > 0
     ORDER BY amount DESC, c.sort_order`,
    time.params,
  );
  return rows.map((r) => ({ categoryId: r.category_id, amount: pesewas(r.amount) }));
}
