/**
 * The UI addresses categories by string. System categories keep the id the UI always used
 * (their `system_key`, except that the migration's `misc` row is the UI's `other`); user-made
 * ones have no key and use their row id. `UI_CATEGORY_ID_SQL` in `src/data/queries` must agree.
 */
export function uiCategoryId(systemKey: string | null, id: number): string {
  if (systemKey === 'misc') return 'other';
  return systemKey ?? String(id);
}
