import { categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { setMeta } from '@/data/meta';
import { listTransactions, needsNoteCount, needsNoteList, transactionDetail } from '@/data/queries';
import { monthRange } from '@/domain/calendar/month';
import { pesewas } from '@/domain/money';
import { ingest } from '../ingest';
import { addManualExpense } from '../manualExpense';
import { editTransaction } from '../transactionEdit';
import { createFileDb } from './fileDb';
import { HOUR, T0, item, paymentFor, received } from './synthetic';

const NOW = T0 + 30 * 24 * HOUR;
const JUNE = monthRange('2024-06');
const TODAY = new Date(NOW);

const first = item(paymentFor('90000000021', '5.00', 'AMA SERWAA'), T0);
const second = item(paymentFor('90000000022', '8.00', 'AMA SERWAA'), T0 + HOUR);
const other = item(paymentFor('90000000023', '9.00', 'KOJO'), T0 + 2 * HOUR);
const incoming = item(received('90000000024', '20.00', 'AMA SERWAA'), T0 + 3 * HOUR);

const idOf = async (db: Db, momo: string) =>
  (await db.get<{ id: number }>('SELECT id FROM transactions WHERE momo_txn_id = ?', [momo]))!.id;

async function seeded() {
  const db = await setup();
  await setMeta(db, 'first_import_at', String(T0 - 1));
  await ingest(db, [first, second, other, incoming], NOW);
  return db;
}

let db: Db;
beforeEach(async () => {
  db = await seeded();
});

describe('editTransaction notes and tags', () => {
  it('saves a note and removes the row from needs-a-note', async () => {
    expect(await needsNoteCount(db, JUNE, NOW)).toBe(3);
    const id = await idOf(db, '90000000021');
    await editTransaction(db, id, { note: '  bus fare ' }, NOW);
    expect(await needsNoteCount(db, JUNE, NOW)).toBe(2);
    expect((await needsNoteList(db, JUNE, NOW)).map((r) => r.row.id)).not.toContain(String(id));
    expect(await transactionDetail(db, id, TODAY)).toMatchObject({
      note: 'bus fare',
      noteSource: 'user',
    });
  });

  it('keeps the note when only the category changes, and the auto category untouched', async () => {
    const id = await idOf(db, '90000000021');
    const auto = await db.get(
      'SELECT auto_category_id AS a, auto_category_source AS s FROM transactions WHERE id = ?',
      [id],
    );
    await editTransaction(db, id, { note: 'soap' }, NOW);
    await editTransaction(db, id, { categoryId: 'shopping' }, NOW);
    expect(await transactionDetail(db, id, TODAY)).toMatchObject({
      note: 'soap',
      categoryId: 'shopping',
    });
    expect(
      await db.get(
        'SELECT auto_category_id AS a, auto_category_source AS s FROM transactions WHERE id = ?',
        [id],
      ),
    ).toEqual(auto);
  });

  it('removes the row from needs-a-note when only a category is picked', async () => {
    const id = await idOf(db, '90000000021');
    await editTransaction(db, id, { categoryId: 'food' }, NOW);
    expect(await needsNoteCount(db, JUNE, NOW)).toBe(2);
  });

  it("stores '' as a cleared note and null stays the SMS reference", async () => {
    const id = await idOf(db, '90000000021');
    await db.run(`UPDATE transactions SET reference_clean = 'bread' WHERE id = ?`, [id]);
    expect(await transactionDetail(db, id, TODAY)).toMatchObject({
      note: 'bread',
      noteSource: 'sms',
    });
    await editTransaction(db, id, { note: '   ' }, NOW);
    expect(await transactionDetail(db, id, TODAY)).toMatchObject({ note: null, noteSource: null });
    expect(
      await db.get('SELECT note FROM transaction_annotations WHERE transaction_id = ?', [id]),
    ).toEqual({ note: '' });
  });

  it('hides a snoozed prompt until the time passes', async () => {
    const id = await idOf(db, '90000000021');
    await editTransaction(db, id, { promptSnoozedUntil: NOW + 1000 }, NOW);
    expect(await needsNoteCount(db, JUNE, NOW)).toBe(2);
    expect(await needsNoteCount(db, JUNE, NOW + 2000)).toBe(3);
    expect(
      await db.get(
        'SELECT note, category_id FROM transaction_annotations WHERE transaction_id = ?',
        [id],
      ),
    ).toEqual({ note: null, category_id: null });
  });

  it('edits a hand-added expense', async () => {
    const id = await addManualExpense(
      db,
      { name: 'Kelewele', amount: pesewas(700), categoryId: 'food', occurredAt: T0 },
      NOW,
    );
    await editTransaction(db, id, { categoryId: 'giving', note: 'for Maa' }, NOW);
    expect(await transactionDetail(db, id, TODAY)).toMatchObject({
      categoryId: 'giving',
      note: 'for Maa',
    });
    const res = await editTransaction(db, id, { categoryId: 'food', alwaysTag: true }, NOW);
    expect(res.ruleSaved).toBe(false);
    expect(await db.get('SELECT COUNT(*) AS n FROM recipient_rules')).toEqual({ n: 0 });
  });

  it('rejects an unknown transaction or category and writes nothing', async () => {
    await expect(editTransaction(db, 9999, { note: 'x' }, NOW)).rejects.toThrow();
    const id = await idOf(db, '90000000021');
    await expect(editTransaction(db, id, { note: 'x', categoryId: 'nope' }, NOW)).rejects.toThrow();
    expect(await db.get('SELECT COUNT(*) AS n FROM transaction_annotations')).toEqual({ n: 0 });
  });
});

describe('always tag this recipient', () => {
  it('saves a rule scoped to spend and recategorises the other payments to that name', async () => {
    const id = await idOf(db, '90000000021');
    const res = await editTransaction(db, id, { categoryId: 'transport', alwaysTag: true }, NOW);
    expect(res.ruleSaved).toBe(true);
    expect(
      await db.all('SELECT match_field, match_value, applies_to FROM recipient_rules'),
    ).toEqual([{ match_field: 'name', match_value: 'ama serwaa', applies_to: 'spend' }]);
    const rows = await listTransactions(db, { range: JUNE });
    const byAmount = Object.fromEntries(rows.map((r) => [r.row.amount, r.row.categoryId]));
    expect(byAmount).toMatchObject({ 800: 'transport', 900: 'other', 2000: 'income' });
    expect(
      await db.get('SELECT auto_category_source AS s FROM transactions WHERE momo_txn_id = ?', [
        '90000000022',
      ]),
    ).toEqual({ s: 'rule' });
  });

  it('updates the rule instead of adding a second one', async () => {
    const id = await idOf(db, '90000000021');
    await editTransaction(db, id, { categoryId: 'transport', alwaysTag: true }, NOW);
    await editTransaction(db, id, { categoryId: 'health', alwaysTag: true }, NOW);
    expect(await db.get('SELECT COUNT(*) AS n FROM recipient_rules')).toEqual({ n: 1 });
    expect(await db.get('SELECT category_id AS c FROM recipient_rules')).toEqual({
      c: await categoryId(db, 'health'),
    });
  });

  it('does not save a rule without the toggle, and never rules for an incoming payment by a spend tag', async () => {
    const id = await idOf(db, '90000000021');
    await editTransaction(db, id, { categoryId: 'transport' }, NOW);
    expect(await db.get('SELECT COUNT(*) AS n FROM recipient_rules')).toEqual({ n: 0 });
    const inId = await idOf(db, '90000000024');
    await editTransaction(db, inId, { categoryId: 'family', alwaysTag: true }, NOW);
    expect(await db.all('SELECT applies_to FROM recipient_rules')).toEqual([
      { applies_to: 'income' },
    ]);
  });
});

describe('after a restart', () => {
  it('still shows the note, tag, snooze and rule', async () => {
    const file = await createFileDb();
    try {
      await setMeta(file.db, 'first_import_at', String(T0 - 1));
      await ingest(file.db, [first, second, other], NOW);
      const a = await idOf(file.db, '90000000021');
      const c = await idOf(file.db, '90000000023');
      await editTransaction(
        file.db,
        a,
        { note: 'soap', categoryId: 'shopping', alwaysTag: true },
        NOW,
      );
      await editTransaction(file.db, c, { promptSnoozedUntil: NOW + HOUR }, NOW);

      const again = file.reopen();
      expect(await transactionDetail(again, a, TODAY)).toMatchObject({
        note: 'soap',
        categoryId: 'shopping',
      });
      expect(await needsNoteCount(again, JUNE, NOW)).toBe(0);
      const second2 = await idOf(again, '90000000022');
      expect(await transactionDetail(again, second2, TODAY)).toMatchObject({
        categoryId: 'shopping',
      });
    } finally {
      file.dispose();
    }
  });
});
