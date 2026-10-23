import { categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { setMeta } from '@/data/meta';
import {
  categoryImpact,
  categoryKeywords,
  keywordCounts,
  listCategories,
  listTransactions,
  transactionDetail,
} from '@/data/queries';
import { addKeyword, createCategory, deleteCategory, removeKeyword } from '../categories';
import { ingest } from '../ingest';
import { editTransaction } from '../transactionEdit';
import { createFileDb } from './fileDb';
import { HOUR, T0, item, paymentCompleted, paymentFor } from './synthetic';

const NOW = T0 + 30 * 24 * HOUR;
const TODAY = new Date(NOW);

// A reference no seed word matches, so the payment starts in Misc.
const withRef = (id: string, ref: string, at: number) =>
  item(
    paymentCompleted(id, '5.00', 'AMA SERWAA').replace('Reference: bread', `Reference: ${ref}`),
    at,
  );

const idOf = async (db: Db, momo: string) =>
  (await db.get<{ id: number }>('SELECT id FROM transactions WHERE momo_txn_id = ?', [momo]))!.id;
const catOf = async (db: Db, momo: string) =>
  (await transactionDetail(db, await idOf(db, momo), TODAY))!.categoryId;

let db: Db;
beforeEach(async () => {
  db = await setup();
  await ingest(
    db,
    [
      withRef('90000000031', 'ndwom', T0),
      withRef('90000000032', 'ndwom', T0 + HOUR),
      withRef('90000000033', 'bread', T0 + 2 * HOUR),
      item(paymentFor('90000000034', '2.00', 'KOJO'), T0 + 3 * HOUR),
    ],
    NOW,
  );
});

describe('createCategory', () => {
  it('inserts after the seeded categories with a valid tint and returns its UI id', async () => {
    const res = await createCategory(db, { name: '  Church  tithe ', color: '#6250D6' }, NOW);
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) throw new Error('unreachable');
    expect(res.id).toMatch(/^\d+$/);
    const list = await listCategories(db);
    const index = list.findIndex((c) => c.id === res.id);
    expect(list[index]).toMatchObject({ name: 'Church tithe', color: '#6250D6' });
    expect(list[index]!.tint).toMatch(/^#[0-9A-F]{6}$/);
    expect(list.slice(index + 1).map((c) => c.id)).toEqual(['cash', 'other']);
    const row = await db.get<{ sort_order: number; seed_version: number | null }>(
      'SELECT sort_order, seed_version FROM categories WHERE name = ?',
      ['Church tithe'],
    );
    const max = await db.get<{ s: number }>(
      'SELECT MAX(sort_order) AS s FROM categories WHERE system_key IS NOT NULL AND sort_order < 900',
    );
    expect(row!.sort_order).toBeGreaterThan(max!.s);
    expect(row!.seed_version).toBeNull();
  });

  it('refuses a name that exists in any case, an empty name and a bad colour', async () => {
    expect(await createCategory(db, { name: 'fOOd', color: '#6250D6' })).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(await createCategory(db, { name: ' ', color: '#6250D6' })).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(await createCategory(db, { name: 'X', color: 'purple' })).toEqual({
      ok: false,
      reason: 'colour',
    });
    expect(await createCategory(db, { name: 'Gifts', color: '#6250D6' })).toMatchObject({
      ok: true,
    });
    expect(await createCategory(db, { name: 'GIFTS', color: '#6250D6' })).toMatchObject({
      reason: 'duplicate',
    });
  });
});

describe('createCategory with words', () => {
  it('saves the words with the category and files matching payments', async () => {
    const res = await createCategory(
      db,
      { name: 'Church', color: '#EB6834', words: [' Ndwom ', 'ndwom', 'hymns'] },
      NOW,
    );
    if (!res.ok) throw new Error('create failed');
    expect((await categoryKeywords(db, res.id)).map((k) => k.value).sort()).toEqual([
      'hymns',
      'ndwom',
    ]);
    expect(await catOf(db, '90000000031')).toBe(res.id);
  });

  it('writes nothing when a word belongs elsewhere or is too common', async () => {
    expect(
      await createCategory(db, { name: 'Church', color: '#EB6834', words: ['hymns', 'bread'] }),
    ).toEqual({
      ok: false,
      reason: 'elsewhere',
      word: 'bread',
      category: 'Food',
    });
    expect(
      await createCategory(db, { name: 'Church', color: '#EB6834', words: ['momo'] }),
    ).toMatchObject({
      reason: 'tooCommon',
    });
    expect(await db.get('SELECT COUNT(*) AS n FROM categories WHERE name = ?', ['Church'])).toEqual(
      { n: 0 },
    );
  });
});

describe('keywords', () => {
  it('adds a normalised word and recategorises matching payments', async () => {
    expect(await catOf(db, '90000000031')).toBe('other');
    const res = await addKeyword(db, 'food', '  NDWOM  ', NOW);
    expect(res).toEqual({ ok: true, value: 'ndwom', added: true });
    expect(await catOf(db, '90000000031')).toBe('food');
    expect(await catOf(db, '90000000032')).toBe('food');
    expect((await categoryKeywords(db, 'food'))[0]).toEqual({
      value: 'ndwom',
      isAlias: false,
      origin: 'user',
    });
    expect(await addKeyword(db, 'food', 'ndwom', NOW)).toEqual({
      ok: true,
      value: 'ndwom',
      added: false,
    });
  });

  it('explains a word that belongs to another category and changes nothing', async () => {
    expect(await addKeyword(db, 'transport', 'bread', NOW)).toEqual({
      ok: false,
      reason: 'elsewhere',
      category: 'Food',
    });
    expect(await catOf(db, '90000000033')).toBe('food');
  });

  it('refuses empty, junk and protected-category words', async () => {
    expect(await addKeyword(db, 'food', '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(await addKeyword(db, 'food', 'MoMo')).toEqual({ ok: false, reason: 'tooCommon' });
    expect(await addKeyword(db, 'family', 'maa')).toEqual({ ok: false, reason: 'noWords' });
    expect(await addKeyword(db, 'other', 'stuffy')).toEqual({ ok: false, reason: 'noWords' });
  });

  it('removes a word and the payments fall back', async () => {
    await removeKeyword(db, 'food', 'bread');
    expect(await catOf(db, '90000000033')).toBe('other');
    expect((await categoryKeywords(db, 'food')).map((k) => k.value)).not.toContain('bread');
    await removeKeyword(db, 'food', 'bread');
  });

  it('counts words per category', async () => {
    const before = await keywordCounts(db);
    await addKeyword(db, 'transport', 'ndwom', NOW);
    expect((await keywordCounts(db)).transport).toBe(before.transport! + 1);
    expect(before.family).toBeUndefined();
  });
});

describe('deleteCategory', () => {
  async function userCategory() {
    const res = await createCategory(db, { name: 'Church', color: '#EB6834' }, NOW);
    if (!res.ok) throw new Error('create failed');
    await addKeyword(db, res.id, 'ndwom', NOW);
    return res.id;
  }

  it('moves payments to Misc, drops words and rules, keeps notes, and reports the counts first', async () => {
    const id = await userCategory();
    const tagged = await idOf(db, '90000000034');
    await editTransaction(db, tagged, { categoryId: id, note: 'keep me', alwaysTag: true }, NOW);
    expect(await catOf(db, '90000000031')).toBe(id);

    expect(await categoryImpact(db, id)).toEqual({
      deletable: true,
      transactions: 3,
      keywords: 1,
      rules: 1,
      allocations: 0,
      budgets: 0,
    });

    await deleteCategory(db, id);

    expect(await catOf(db, '90000000031')).toBe('other');
    expect(await catOf(db, '90000000034')).toBe('other');
    const detail = await transactionDetail(db, tagged, TODAY);
    expect(detail).toMatchObject({ note: 'keep me', categoryId: 'other' });
    expect(await db.get('SELECT COUNT(*) AS n FROM recipient_rules')).toEqual({ n: 0 });
    expect(await db.get('SELECT COUNT(*) AS n FROM keywords WHERE value = ?', ['ndwom'])).toEqual({
      n: 0,
    });
    expect((await listCategories(db)).map((c) => c.id)).not.toContain(id);
    expect(await categoryImpact(db, id)).toBeNull();
  });

  it('refuses system categories', async () => {
    await expect(deleteCategory(db, 'food')).rejects.toThrow();
    await expect(deleteCategory(db, 'other')).rejects.toThrow();
    expect((await categoryImpact(db, 'food'))!.deletable).toBe(false);
    expect(await categoryId(db, 'food')).toBeGreaterThan(0);
  });

  it('counts budget limits in the confirmation and removes them with the category', async () => {
    const id = await userCategory();
    const row = await db.get<{ id: number }>('SELECT id FROM categories WHERE name = ?', [
      'Church',
    ]);
    await db.run(
      `INSERT INTO budget_plans (start_day, end_day, total_pesewas, created_at, updated_at)
       VALUES ('2026-11-01', '2026-11-30', 10000, 1, 1)`,
    );
    await db.run(
      'INSERT INTO budget_limits (plan_id, category_id, limit_pesewas) VALUES (1, ?, 500)',
      [row!.id],
    );
    expect((await categoryImpact(db, id))!.budgets).toBe(1);
    await deleteCategory(db, id);
    expect(await db.get('SELECT COUNT(*) AS n FROM budget_limits')).toEqual({ n: 0 });
  });
});

describe('after a restart', () => {
  it('keeps the new category, its word and the payments filed under it', async () => {
    const file = await createFileDb();
    try {
      await setMeta(file.db, 'owner_name', 'nobody');
      await ingest(file.db, [withRef('90000000041', 'ndwom', T0)], NOW);
      const made = await createCategory(file.db, { name: 'Church', color: '#EB6834' }, NOW);
      if (!made.ok) throw new Error('create failed');
      await addKeyword(file.db, made.id, 'ndwom', NOW);

      const again = file.reopen();
      expect((await listCategories(again)).map((c) => c.name)).toContain('Church');
      expect((await categoryKeywords(again, made.id)).map((k) => k.value)).toEqual(['ndwom']);
      const rows = await listTransactions(again, { categoryId: made.id });
      expect(rows).toHaveLength(1);
    } finally {
      file.dispose();
    }
  });
});
