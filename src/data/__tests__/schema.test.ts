import { addLink, addMessage, addTxn, annotate, categoryId, month, setup, sum } from './fixtures';

const M = month(10);
const IN_M = [M.start, M.end] as const;

describe('constraints', () => {
  it('STRICT rejects a REAL in a money column', async () => {
    const db = await setup();
    await expect(addTxn(db, { amount_pesewas: 10.5 })).rejects.toThrow(/cannot store REAL/);
    await expect(addTxn(db, { fee_pesewas: 0.5 })).rejects.toThrow(/cannot store REAL/);
  });

  it.each([
    ['negative amount', { amount_pesewas: -1 }],
    ['unknown flow', { flow: 'sideways' }],
    ['unknown time source', { occurred_at_source: 'guess' }],
    ['sms row without a txn id', { momo_txn_id: null }],
    ['sms row with user time', { occurred_at_source: 'user' }],
    ['sms row without an auto category', { auto_category_id: null, auto_category_source: null }],
    ['category id without a source', { auto_category_source: null }],
  ])('rejects %s', async (_name, over) => {
    const db = await setup();
    await expect(addTxn(db, over)).rejects.toThrow(/CHECK/);
  });

  it('accepts a manual row with no auto category and no txn id', async () => {
    const db = await setup();
    await expect(addTxn(db, { origin: 'manual' })).resolves.toBeGreaterThan(0);
  });

  it('rejects a manual row that carries a txn id or an sms-only time source', async () => {
    const db = await setup();
    await expect(addTxn(db, { origin: 'manual', momo_txn_id: 'x' })).rejects.toThrow(/CHECK/);
    await expect(addTxn(db, { origin: 'manual', occurred_at_source: 'body' })).rejects.toThrow(
      /CHECK/,
    );
  });

  it('rejects an ignored or errored message without a reason, and a reason on others', async () => {
    const db = await setup();
    await expect(addMessage(db, { status: 'ignored' })).rejects.toThrow(/CHECK/);
    await expect(addMessage(db, { status: 'error' })).rejects.toThrow(/CHECK/);
    await expect(addMessage(db, { status: 'parsed', reason: 'otp' })).rejects.toThrow(/CHECK/);
    await expect(addMessage(db, { status: 'unparsed', reason: 'x' })).rejects.toThrow(/CHECK/);
    await expect(addMessage(db, { status: 'ignored', reason: 'otp' })).resolves.toBeGreaterThan(0);
  });

  it('rejects duplicate category names in a different case', async () => {
    const db = await setup();
    await expect(
      db.run(
        `INSERT INTO categories (name, color, tint, created_at, updated_at) VALUES ('FOOD','#000000','#000000',1,1)`,
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('rejects a colour that is not #RRGGBB', async () => {
    const db = await setup();
    await expect(
      db.run(
        `INSERT INTO categories (name, color, tint, created_at, updated_at) VALUES ('X','red','#000000',1,1)`,
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('rejects deleting a category still used by a transaction (foreign keys on)', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    await addTxn(db, { auto_category_id: food });
    await expect(db.run('DELETE FROM categories WHERE id = ?', [food])).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('rejects deleting a protected category and changing a system_key', async () => {
    const db = await setup();
    for (const key of ['family', 'friends', 'cash', 'income', 'misc']) {
      await expect(db.run('DELETE FROM categories WHERE system_key = ?', [key])).rejects.toThrow(
        /protected/,
      );
    }
    await expect(
      db.run(`UPDATE categories SET system_key = 'x' WHERE system_key = 'food'`),
    ).rejects.toThrow(/immutable/);
  });

  it('still blocks protected-category and sms-row deletes with foreign_keys OFF', async () => {
    const db = await setup();
    const msg = await addMessage(db);
    const txn = await addTxn(db);
    await db.exec('PRAGMA foreign_keys = OFF');
    await expect(db.run(`DELETE FROM categories WHERE system_key = 'misc'`)).rejects.toThrow(
      /protected/,
    );
    await expect(db.run('DELETE FROM sms_messages WHERE id = ?', [msg])).rejects.toThrow(
      /never deleted/,
    );
    await expect(db.run('DELETE FROM transactions WHERE id = ?', [txn])).rejects.toThrow(
      /never deleted/,
    );
  });
});

describe('sms identity', () => {
  it('allows a reused Android id only after the old row is marked gone', async () => {
    const db = await setup();
    const old = await addMessage(db, { android_sms_id: 500, received_at: 1 });
    await expect(addMessage(db, { android_sms_id: 500, received_at: 2 })).rejects.toThrow(/UNIQUE/);
    await db.run('UPDATE sms_messages SET gone_at = 9 WHERE id = ?', [old]);
    const reuse = await addMessage(db, { android_sms_id: 500, received_at: 2 });
    expect(reuse).not.toBe(old);
  });

  it('keeps message identity immutable', async () => {
    const db = await setup();
    const id = await addMessage(db);
    await expect(
      db.run('UPDATE sms_messages SET received_at = 5 WHERE id = ?', [id]),
    ).rejects.toThrow(/immutable/);
  });

  it('blocks deleting an sms transaction but allows retracting it', async () => {
    const db = await setup();
    const t = await addTxn(db);
    await expect(db.run('DELETE FROM transactions WHERE id = ?', [t])).rejects.toThrow(
      /never deleted/,
    );
    await db.run('UPDATE transactions SET retracted_at = 5 WHERE id = ?', [t]);
    expect(await db.get('SELECT 1 FROM transaction_list WHERE id = ?', [t])).toBeNull();
  });

  it('keeps transaction identity immutable', async () => {
    const db = await setup();
    const t = await addTxn(db);
    await expect(
      db.run(`UPDATE transactions SET momo_txn_id = 'other' WHERE id = ?`, [t]),
    ).rejects.toThrow(/immutable/);
  });

  it('lists unread messages until dismissed or typed in by hand', async () => {
    const db = await setup();
    const a = await addMessage(db, { status: 'unparsed' });
    const b = await addMessage(db, { status: 'unparsed' });
    const c = await addMessage(db, { status: 'error', reason: 'boom' });
    await db.run('INSERT INTO message_dismissals VALUES (?, 1)', [b]);
    await addTxn(db, { origin: 'manual', source_message_id: c });
    const ids = await db.all<{ id: number }>('SELECT id FROM unread_messages');
    expect(ids.map((r) => r.id)).toEqual([a]);
  });
});

describe('reversal links', () => {
  it('only joins a credit to a spend row', async () => {
    const db = await setup();
    const spend = await addTxn(db);
    const income = await addTxn(db, { flow: 'income', kind: 'payment_in' });
    const credit = await addTxn(db, { flow: 'credit', kind: 'reversal' });
    await expect(addLink(db, spend, credit)).rejects.toThrow(/credit to a spend/);
    await expect(addLink(db, credit, income)).rejects.toThrow(/credit to a spend/);
    await expect(addLink(db, credit, spend)).resolves.toBeGreaterThan(0);
    await expect(
      db.run('UPDATE reversal_links SET original_txn_id = ? WHERE credit_txn_id = ?', [
        income,
        credit,
      ]),
    ).rejects.toThrow(/credit to a spend/);
  });

  it('lets a user record "no original" but not an auto link without one', async () => {
    const db = await setup();
    const credit = await addTxn(db, { flow: 'credit', kind: 'reversal' });
    await expect(addLink(db, credit, null)).rejects.toThrow(/CHECK/);
    await expect(
      addLink(db, credit, null, { linked_by: 'user', confidence: null }),
    ).resolves.toBeGreaterThan(0);
  });
});

describe('annotations and effective category', () => {
  it('keeps a note when its category is deleted', async () => {
    const db = await setup();
    const rent = await categoryId(db, 'rent');
    const t = await addTxn(db);
    await annotate(db, t, { category_id: rent, note: 'March rent' });
    await db.run('DELETE FROM categories WHERE id = ?', [rent]);
    expect(
      await db.get(
        'SELECT category_id, note FROM transaction_annotations WHERE transaction_id = ?',
        [t],
      ),
    ).toEqual({ category_id: null, note: 'March rent' });
  });

  it('prefers the user tag, then the auto category, then Misc', async () => {
    const db = await setup();
    const [food, rent, misc] = [
      await categoryId(db, 'food'),
      await categoryId(db, 'rent'),
      await categoryId(db, 'misc'),
    ];
    const tagged = await addTxn(db, { auto_category_id: food });
    await annotate(db, tagged, { category_id: rent });
    const auto = await addTxn(db, { auto_category_id: food });
    const manual = await addTxn(db, { origin: 'manual' });
    const cat = async (id: number) =>
      (await db.get<{ category_id: number; category_source: string | null }>(
        'SELECT category_id, category_source FROM transaction_list WHERE id = ?',
        [id],
      ))!;
    expect(await cat(tagged)).toEqual({ category_id: rent, category_source: 'manual' });
    expect(await cat(auto)).toEqual({ category_id: food, category_source: 'default' });
    expect(await cat(manual)).toEqual({ category_id: misc, category_source: null });
  });

  it('resolves to Misc when the tag or the auto id points at a deleted category (FKs off)', async () => {
    const db = await setup();
    const misc = await categoryId(db, 'misc');
    await db.exec('PRAGMA foreign_keys = OFF');
    const t = await addTxn(db);
    await annotate(db, t, { category_id: 9999 });
    const auto = await addTxn(db, { auto_category_id: 8888 });
    const rows = await db.all<{ transaction_id: number; category_id: number }>(
      'SELECT * FROM transaction_category WHERE transaction_id IN (?, ?)',
      [t, auto],
    );
    expect(rows.map((r) => r.category_id)).toEqual([misc, misc]);
    expect(await sum(db, 'category_id = ?', [misc])).toBe(2000);
  });

  it('shows the SMS reference, a user note over it, and NULL once the user cleared it', async () => {
    const db = await setup();
    const t = await addTxn(db, { reference_clean: 'rent' });
    const note = async () =>
      (await db.get<{ note: string | null; note_source: string | null }>(
        'SELECT note, note_source FROM transaction_list WHERE id = ?',
        [t],
      ))!;
    expect(await note()).toEqual({ note: 'rent', note_source: 'sms' });
    await annotate(db, t, { note: 'my note' });
    expect(await note()).toEqual({ note: 'my note', note_source: 'user' });
    await db.run(`UPDATE transaction_annotations SET note = '' WHERE transaction_id = ?`, [t]);
    expect(await note()).toEqual({ note: null, note_source: null });
    await expect(
      db.run(`UPDATE transaction_annotations SET note = ' x ' WHERE transaction_id = ?`, [t]),
    ).rejects.toThrow(/CHECK/);
  });
});

describe('ledger_lines', () => {
  it('sums spend with charges, income, and charges separately', async () => {
    const db = await setup();
    await addTxn(db, {
      amount_pesewas: 1000,
      fee_pesewas: 60,
      tax_pesewas: 40,
      occurred_at: M.start,
    });
    await addTxn(db, {
      flow: 'income',
      kind: 'payment_in',
      amount_pesewas: 7000,
      occurred_at: M.start,
    });
    await addTxn(db, { amount_pesewas: 500, occurred_at: M.end });
    expect(await sum(db, `bucket = 'spend' AND at >= ? AND at < ?`, IN_M)).toBe(1100);
    expect(await sum(db, `bucket = 'income' AND at >= ? AND at < ?`, IN_M)).toBe(7000);
    expect(await sum(db, `part = 'charge' AND at >= ? AND at < ?`, IN_M)).toBe(100);
  });

  it('nets partial refunds in the original month: 1000 + 60 fee - 300 - 200 = 560', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const original = await addTxn(db, {
      amount_pesewas: 1000,
      fee_pesewas: 60,
      occurred_at: M.start + 1,
      auto_category_id: food,
    });
    for (const [amount, at] of [
      [300, M.end + 5],
      [200, M.end + 9],
    ] as const) {
      const credit = await addTxn(db, {
        flow: 'credit',
        kind: 'refund',
        amount_pesewas: amount,
        occurred_at: at,
      });
      await addLink(db, credit, original);
    }
    const spend = `bucket = 'spend' AND category_id = ? AND at >= ? AND at < ?`;
    expect(await sum(db, spend, [food, M.start, M.end])).toBe(560);
    expect(await sum(db, `bucket = 'spend' AND at >= ? AND at < ?`, [M.end, M.end + 100])).toBe(0);
  });

  it('caps credits at the original amount so an over-refund never goes negative', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    const original = await addTxn(db, {
      amount_pesewas: 1000,
      fee_pesewas: 60,
      occurred_at: M.start,
      auto_category_id: food,
    });
    for (const amount of [800, 700]) {
      const credit = await addTxn(db, { flow: 'credit', kind: 'refund', amount_pesewas: amount });
      await addLink(db, credit, original);
    }
    expect(await sum(db, 'category_id = ?', [food])).toBe(60);
  });

  it('puts an unlinked credit in its own month and category', async () => {
    const db = await setup();
    const food = await categoryId(db, 'food');
    await addTxn(db, { amount_pesewas: 1000, occurred_at: M.start, auto_category_id: food });
    await addTxn(db, {
      flow: 'credit',
      kind: 'reversal',
      amount_pesewas: 400,
      occurred_at: M.end + 1,
      auto_category_id: food,
    });
    expect(await sum(db, 'at >= ? AND at < ?', [M.start, M.end])).toBe(1000);
    expect(await sum(db, 'at >= ?', [M.end])).toBe(-400);
  });

  it('treats a credit whose original is retracted, or marked "no original", as unlinked', async () => {
    const db = await setup();
    const original = await addTxn(db, { amount_pesewas: 1000, occurred_at: M.start });
    const credit = await addTxn(db, {
      flow: 'credit',
      kind: 'reversal',
      amount_pesewas: 400,
      occurred_at: M.end,
    });
    await addLink(db, credit, original);
    await db.run('UPDATE transactions SET retracted_at = 1 WHERE id = ?', [original]);
    expect(await sum(db, '1 = 1')).toBe(-400);

    const lone = await addTxn(db, { flow: 'credit', kind: 'reversal', amount_pesewas: 50 });
    await addLink(db, lone, null, { linked_by: 'user', confidence: null });
    expect(await sum(db, 'transaction_id = ?', [lone])).toBe(-50);
  });

  it('follows the user tag: a credit offsets the original category as tagged', async () => {
    const db = await setup();
    const rent = await categoryId(db, 'rent');
    const original = await addTxn(db, { amount_pesewas: 1000 });
    await annotate(db, original, { category_id: rent });
    const credit = await addTxn(db, { flow: 'credit', kind: 'reversal', amount_pesewas: 1000 });
    await addLink(db, credit, original);
    expect(await sum(db, 'category_id = ?', [rent])).toBe(0);
    expect(await sum(db, 'category_id <> ?', [rent])).toBe(0);
  });

  it('does not count retracted rows', async () => {
    const db = await setup();
    await addTxn(db, { retracted_at: 5 });
    expect(await sum(db, '1 = 1')).toBe(0);
  });
});
