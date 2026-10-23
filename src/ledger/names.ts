import type { Db } from '@/data/db';
import { normaliseWord } from '@/domain/category/word';

import { recategoriseIn } from './recategorise';
import { ledgerQueue } from './writeQueue';

export type NameKind = 'family' | 'friend';

export type AddNameResult =
  | { ok: true; value: string; added: boolean; changed: number }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'otherList'; list: NameKind };

/** Adds to the Family or Friends list, then recategorises. A name is in one list only. */
export function addName(
  db: Db,
  kind: NameKind,
  name: string,
  now: number = Date.now(),
): Promise<AddNameResult> {
  const value = normaliseWord(name);
  if (value === '') return Promise.resolve({ ok: false, reason: 'empty' });
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<AddNameResult> => {
      const existing = await tx.get<{ kind: NameKind }>(
        'SELECT kind FROM name_lists WHERE value = ?',
        [value],
      );
      if (existing) {
        return existing.kind === kind
          ? { ok: true, value, added: false, changed: 0 }
          : { ok: false, reason: 'otherList', list: existing.kind };
      }
      await tx.run('INSERT INTO name_lists (kind, value, created_at) VALUES (?, ?, ?)', [
        kind,
        value,
        now,
      ]);
      const { changed } = await recategoriseIn(tx);
      return { ok: true, value, added: true, changed };
    }),
  );
}

/** Resolves to how many payments changed category. */
export function removeName(db: Db, kind: NameKind, name: string): Promise<number> {
  const value = normaliseWord(name);
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      const { changes } = await tx.run('DELETE FROM name_lists WHERE kind = ? AND value = ?', [
        kind,
        value,
      ]);
      return changes > 0 ? (await recategoriseIn(tx)).changed : 0;
    }),
  );
}
