import { categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { setMeta } from '@/data/meta';
import { finishImport } from '../finishImport';
import { ingest } from '../ingest';
import { recategorise } from '../recategorise';
import { BATCH, HOUR, T0, dump, item, merchantPaid, paymentCompleted } from './synthetic';

const NOW = 5_000_000;
let db: Db;
beforeEach(async () => {
  db = await setup();
});

const batch = [
  item(paymentCompleted('90000000010', '5.00', 'KWAME'), T0),
  item(merchantPaid('90000000011', '12.00', '033097'), T0 + HOUR),
];

const auto = (id: string) =>
  db.get<{ key: string; source: string; clean: string | null; self: number }>(
    `SELECT c.system_key AS key, t.auto_category_source AS source, t.reference_clean AS clean,
       t.is_self_transfer AS self
     FROM transactions t JOIN categories c ON c.id = t.auto_category_id WHERE t.momo_txn_id = ?`,
    [id],
  );

describe('ingest categorisation', () => {
  it('categorises from the reference and stores the cleaned reference', async () => {
    await ingest(db, batch, NOW);
    expect(await auto('90000000010')).toEqual({
      key: 'food',
      source: 'keyword',
      clean: 'bread',
      self: 0,
    });
    expect(await auto('90000000011')).toMatchObject({ key: 'food', clean: 'bread' });
  });

  it('flags a transfer to the owner as a self transfer', async () => {
    await setMeta(db, 'owner_name', 'kwame');
    await ingest(db, batch, NOW);
    expect((await auto('90000000010'))!.self).toBe(1);
    expect((await auto('90000000011'))!.self).toBe(0);
  });

  it('stays idempotent', async () => {
    await ingest(db, [...BATCH, ...batch], NOW);
    const once = await dump(db);
    await ingest(db, [...BATCH, ...batch], NOW);
    expect(await dump(db)).toEqual(once);
  });
});

describe('recategorise', () => {
  it('follows keyword, name and rule edits and leaves annotations alone', async () => {
    await ingest(db, [...BATCH, ...batch], NOW);
    const t = (await db.get<{ id: number }>(
      `SELECT id FROM transactions WHERE momo_txn_id = '90000000010'`,
    ))!;
    const giving = await categoryId(db, 'giving');
    await db.run(
      `INSERT INTO transaction_annotations (transaction_id, category_id, note, updated_at) VALUES (?, ?, 'mine', 1)`,
      [t.id, giving],
    );
    const annotations = await db.all('SELECT * FROM transaction_annotations');

    await db.run(`DELETE FROM keywords WHERE value = 'bread'`);
    await db.run(
      `INSERT INTO keywords (category_id, value, is_alias, origin, created_at) VALUES (?, 'bread', 0, 'user', 1)`,
      [await categoryId(db, 'shopping')],
    );
    const first = await recategorise(db);
    expect(first.changed).toBe(2);
    expect(await auto('90000000010')).toMatchObject({ key: 'shopping', source: 'keyword' });
    expect(await db.all('SELECT * FROM transaction_annotations')).toEqual(annotations);
    const view = await db.get<{ category_id: number }>(
      'SELECT category_id FROM transaction_list WHERE id = ?',
      [t.id],
    );
    expect(view!.category_id).toBe(giving);

    await db.run(`INSERT INTO name_lists (kind, value, created_at) VALUES ('friend', 'bread', 1)`);
    await recategorise(db);
    expect((await auto('90000000011'))!.key).toBe('friends');

    await db.run(
      `INSERT INTO recipient_rules (match_field, match_value, applies_to, category_id, created_at, updated_at)
       VALUES ('merchant_code', '033097', 'spend', ?, 1, 1)`,
      [await categoryId(db, 'transport')],
    );
    await recategorise(db);
    expect(await auto('90000000011')).toMatchObject({ key: 'transport', source: 'rule' });
  });

  it('changes nothing the second time', async () => {
    await ingest(db, [...BATCH, ...batch], NOW);
    expect(await recategorise(db)).toEqual({ changed: 0 });
  });

  it('runs at the end of an import', async () => {
    await ingest(db, batch, NOW);
    await db.run(`UPDATE keywords SET category_id = ? WHERE value = 'bread'`, [
      await categoryId(db, 'shopping'),
    ]);
    await finishImport(db, NOW);
    expect((await auto('90000000010'))!.key).toBe('shopping');
  });

  it('picks up a new owner for self transfers', async () => {
    await ingest(db, batch, NOW);
    await setMeta(db, 'owner_name', 'Kwame');
    await recategorise(db);
    expect((await auto('90000000010'))!.self).toBe(1);
  });
});
