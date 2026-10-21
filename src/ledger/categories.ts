import type { Db } from '@/data/db';
import { JUNK_REFERENCES } from '@/domain/categorise/reference';
import { isHexColor, normaliseWord, tintOf } from '@/domain/category/word';
import { uiCategoryId } from '@/domain/category/ids';

import { requireCategoryRowId } from './categoryRef';
import { recategoriseIn } from './recategorise';
import { ledgerQueue } from './writeQueue';

const PROTECTED = ['family', 'friends', 'income', 'cash', 'misc'];
// Seeded categories end below this; Cash (900) and Misc (999) stay last in the list.
const LAST_SORT_BEFORE = 900;

export type CreateCategoryResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'empty' | 'duplicate' | 'colour' }
  | { ok: false; reason: 'tooCommon'; word: string }
  | { ok: false; reason: 'elsewhere'; word: string; category: string };

/**
 * A new category sorts after the seeded ones, so on a keyword tie the seeded category wins. Any
 * starting `words` are saved with it, or nothing is saved if one of them cannot be used.
 */
export function createCategory(
  db: Db,
  input: { name: string; color: string; words?: readonly string[] },
  now: number = Date.now(),
): Promise<CreateCategoryResult> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name === '') return Promise.resolve({ ok: false, reason: 'empty' });
  if (!isHexColor(input.color)) return Promise.resolve({ ok: false, reason: 'colour' });
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<CreateCategoryResult> => {
      // The name column is COLLATE NOCASE, so this equality ignores case.
      if (await tx.get('SELECT 1 FROM categories WHERE name = ?', [name])) {
        return { ok: false, reason: 'duplicate' };
      }
      const words = [...new Set((input.words ?? []).map(normaliseWord).filter((w) => w !== ''))];
      for (const word of words) {
        if (JUNK_REFERENCES.has(word)) return { ok: false, reason: 'tooCommon', word };
        const owner = await wordOwner(tx, word);
        if (owner) return { ok: false, reason: 'elsewhere', word, category: owner.name };
      }
      const last = await tx.get<{ s: number | null }>(
        'SELECT MAX(sort_order) AS s FROM categories WHERE sort_order < ?',
        [LAST_SORT_BEFORE],
      );
      const { lastInsertRowId } = await tx.run(
        `INSERT INTO categories (name, color, tint, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, input.color, tintOf(input.color), (last?.s ?? 0) + 10, now, now],
      );
      for (const word of words) {
        await tx.run(
          `INSERT INTO keywords (category_id, value, is_alias, origin, created_at)
           VALUES (?, ?, 0, 'user', ?)`,
          [lastInsertRowId, word, now],
        );
      }
      if (words.length > 0) await recategoriseIn(tx);
      return { ok: true, id: uiCategoryId(null, lastInsertRowId) };
    }),
  );
}

const wordOwner = (tx: Db, value: string) =>
  tx.get<{ category_id: number; name: string }>(
    `SELECT k.category_id, c.name FROM keywords k JOIN categories c ON c.id = k.category_id
     WHERE k.value = ?`,
    [value],
  );

export type AddKeywordResult =
  | { ok: true; value: string; added: boolean }
  | { ok: false; reason: 'empty' | 'tooCommon' | 'noWords' }
  | { ok: false; reason: 'elsewhere'; category: string };

/** Adds a word, then recategorises, in one transaction. A word belongs to one category. */
export function addKeyword(
  db: Db,
  categoryId: string,
  word: string,
  now: number = Date.now(),
): Promise<AddKeywordResult> {
  const value = normaliseWord(word);
  if (value === '') return Promise.resolve({ ok: false, reason: 'empty' });
  if (JUNK_REFERENCES.has(value)) return Promise.resolve({ ok: false, reason: 'tooCommon' });
  return ledgerQueue.run(() =>
    db.transaction(async (tx): Promise<AddKeywordResult> => {
      const id = await requireCategoryRowId(tx, categoryId);
      const category = (await tx.get<{ system_key: string | null }>(
        'SELECT system_key FROM categories WHERE id = ?',
        [id],
      ))!;
      // Family and Friends use name lists; Income, Cash and Misc come from the kind of payment.
      if (category.system_key !== null && PROTECTED.includes(category.system_key)) {
        return { ok: false, reason: 'noWords' };
      }
      const owner = await wordOwner(tx, value);
      if (owner !== null) {
        return owner.category_id === id
          ? { ok: true, value, added: false }
          : { ok: false, reason: 'elsewhere', category: owner.name };
      }
      await tx.run(
        `INSERT INTO keywords (category_id, value, is_alias, origin, created_at)
         VALUES (?, ?, 0, 'user', ?)`,
        [id, value, now],
      );
      await recategoriseIn(tx);
      return { ok: true, value, added: true };
    }),
  );
}

export function removeKeyword(db: Db, categoryId: string, word: string): Promise<void> {
  const value = normaliseWord(word);
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      const id = await requireCategoryRowId(tx, categoryId);
      const { changes } = await tx.run('DELETE FROM keywords WHERE category_id = ? AND value = ?', [
        id,
        value,
      ]);
      if (changes > 0) await recategoriseIn(tx);
    }),
  );
}

/**
 * system-design 7.8. Payments that showed under the category move to Misc, its words and rules
 * go, notes stay. Protected and seeded categories (those with a system key) cannot be deleted.
 * The auto category is RESTRICT, so the recategorise runs before the delete.
 */
export function deleteCategory(db: Db, categoryId: string): Promise<void> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      const id = await requireCategoryRowId(tx, categoryId);
      const row = await tx.get<{ system_key: string | null }>(
        'SELECT system_key FROM categories WHERE id = ?',
        [id],
      );
      if (row!.system_key !== null) throw new Error('system categories cannot be deleted');
      const misc = await requireCategoryRowId(tx, 'other');
      await tx.run('UPDATE transaction_annotations SET category_id = ? WHERE category_id = ?', [
        misc,
        id,
      ]);
      await tx.run('DELETE FROM recipient_rules WHERE category_id = ?', [id]);
      await tx.run('DELETE FROM keywords WHERE category_id = ?', [id]);
      await recategoriseIn(tx);
      await tx.run('DELETE FROM categories WHERE id = ?', [id]);
    }),
  );
}
