import type { Db } from '@/data/db';
import { PARSER_VERSION } from '@/domain/parse/types';

import { linkUnlinkedCredits } from './finishImport';
import { recategoriseIn } from './recategorise';

/**
 * Closes an inbox scan: links every unlinked reversal, marks the first import done and
 * recategorises. Unlike finishImport it leaves `last_import_at` alone, because that date belongs
 * to backup files. Safe to run again.
 */
export async function finishScan(db: Db, now: number = Date.now()): Promise<{ linked: number }> {
  return db.transaction(async (tx) => {
    const linked = await linkUnlinkedCredits(tx, now);
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('first_import_done', '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('first_import_at', ?) ON CONFLICT(key) DO NOTHING`,
      [String(now)],
    );
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('parser_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(PARSER_VERSION)],
    );
    await recategoriseIn(tx);
    return { linked };
  });
}
