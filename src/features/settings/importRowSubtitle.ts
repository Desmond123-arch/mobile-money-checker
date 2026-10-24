export const IMPORT_ROW_HINT = 'Add messages from an SMS Backup & Restore export';

/** `lastImportAt` is meta.last_import_at, falling back to first_import_at on installs that predate it. */
export function importRowSubtitle(lastImportAt: string | null): string {
  const at = Number(lastImportAt);
  if (lastImportAt === null || !Number.isFinite(at)) return IMPORT_ROW_HINT;
  const date = new Date(at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Last imported ${date}`;
}
