import type { Db } from '../db';
import { getMeta } from '../meta';
import type { TimeRange } from '@/domain/calendar/month';
import type { DatedRow } from '@/domain/transaction/day';

import { mapRow, ROW_COLUMNS, type ListRow } from './transactions';
import { inRange } from './sql';

// "What were these for?": outgoing SMS payments the categoriser could not place (Misc) that have
// no note of any kind and were not snoozed. Only payments after the first import count, so a
// backup of old messages does not open with a thousand questions (design 3.2).
async function where(db: Db, range: TimeRange | null, now: number) {
  const first = await getMeta(db, 'first_import_at');
  if (first === null) return null;
  const time = range ? inRange('l.occurred_at', range) : { sql: '1', params: [] as const };
  return {
    sql: `l.origin = 'sms' AND l.flow = 'spend' AND l.note IS NULL
          AND l.category_id = (SELECT id FROM categories WHERE system_key = 'misc')
          AND l.occurred_at > ?
          AND (l.prompt_snoozed_until IS NULL OR l.prompt_snoozed_until <= ?)
          AND NOT EXISTS (SELECT 1 FROM transaction_annotations a
                          WHERE a.transaction_id = l.id AND a.note IS NOT NULL)
          AND ${time.sql}`,
    params: [Number(first), now, ...time.params],
  };
}

export async function needsNoteCount(
  db: Db,
  range: TimeRange | null,
  now: number,
): Promise<number> {
  const w = await where(db, range, now);
  if (w === null) return 0;
  const row = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transaction_list l WHERE ${w.sql}`,
    w.params,
  );
  return row?.n ?? 0;
}

export async function needsNoteList(
  db: Db,
  range: TimeRange | null,
  now: number,
): Promise<DatedRow[]> {
  const w = await where(db, range, now);
  if (w === null) return [];
  const rows = await db.all<ListRow>(
    `SELECT ${ROW_COLUMNS}
     FROM transaction_list l JOIN categories c ON c.id = l.category_id
     WHERE ${w.sql} ORDER BY l.occurred_at DESC, l.id DESC`,
    w.params,
  );
  return rows.map(mapRow);
}
