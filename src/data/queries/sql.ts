import type { TimeRange } from '@/domain/calendar/month';

/**
 * The UI id of the categories row aliased `c`: the system key, except that the migration's
 * `misc` row is the UI's `other`; user-made rows use their numeric id. Matches `uiCategoryId`.
 */
export const UI_CATEGORY_ID_SQL = `COALESCE(CASE c.system_key WHEN 'misc' THEN 'other' END, c.system_key, CAST(c.id AS TEXT))`;

/** Time ranges are [start, end). `column` is the epoch-ms column to bound. */
export const inRange = (column: string, range: TimeRange) => ({
  sql: `${column} >= ? AND ${column} < ?`,
  params: [range.start, range.end] as const,
});

/** Escapes LIKE wildcards so a search for `50%` matches the text, not everything. */
export const likePattern = (text: string): string =>
  `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
