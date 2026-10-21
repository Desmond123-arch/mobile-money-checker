import { addMessage, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { listTransactions, nameLists, needsNoteCount, unreadMessages } from '@/data/queries';
import { pesewas } from '@/domain/money';
import { ingest } from '../ingest';
import { addManualExpense } from '../manualExpense';
import { addName, removeName } from '../names';
import { dismissMessage } from '../unread';
import { createFileDb } from './fileDb';
import { BATCH, HOUR, T0, item, paymentCompleted } from './synthetic';

const NOW = T0 + 30 * 24 * HOUR;

const toMaa = (id: string, ref: string, at: number) =>
  item(paymentCompleted(id, '5.00', 'KOJO').replace('Reference: bread', `Reference: ${ref}`), at);

async function idOf(db: Db, momo: string) {
  return (await db.get<{ id: number }>('SELECT id FROM transactions WHERE momo_txn_id = ?', [
    momo,
  ]))!.id;
}
const catOf = async (db: Db, momo: string) => {
  const id = await idOf(db, momo);
  return (await listTransactions(db)).find((r) => r.row.id === String(id))!.row.categoryId;
};

let db: Db;
beforeEach(async () => {
  db = await setup();
});

describe('name lists', () => {
  beforeEach(async () => {
    await ingest(
      db,
      [toMaa('90000000051', 'for maa', T0), toMaa('90000000052', 'for paa', T0 + HOUR)],
      NOW,
    );
  });

  it('adds a normalised name and files payments that mention it', async () => {
    expect(await catOf(db, '90000000051')).toBe('other');
    expect(await addName(db, 'family', '  MAA ', NOW)).toEqual({
      ok: true,
      value: 'maa',
      added: true,
    });
    expect(await catOf(db, '90000000051')).toBe('family');
    expect(await catOf(db, '90000000052')).toBe('other');
    expect(await nameLists(db)).toEqual({ family: ['maa'], friend: [] });
    expect(await addName(db, 'family', 'maa')).toEqual({ ok: true, value: 'maa', added: false });
  });

  it('keeps a name in one list only and says which', async () => {
    await addName(db, 'family', 'maa');
    expect(await addName(db, 'friend', 'Maa')).toEqual({
      ok: false,
      reason: 'otherList',
      list: 'family',
    });
    expect(await nameLists(db)).toEqual({ family: ['maa'], friend: [] });
    expect(await addName(db, 'friend', '  ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('removes a name and the payments fall back', async () => {
    await addName(db, 'friend', 'paa');
    expect(await catOf(db, '90000000052')).toBe('friends');
    await removeName(db, 'friend', 'paa');
    expect(await catOf(db, '90000000052')).toBe('other');
    await removeName(db, 'friend', 'paa');
    expect(await nameLists(db)).toEqual({ family: [], friend: [] });
  });
});

describe('messages we could not read', () => {
  it('lists only inbox messages, so a backup import leaves it empty', async () => {
    await ingest(db, BATCH, NOW);
    expect(await unreadMessages(db)).toEqual([]);
    const id = await addMessage(db, { status: 'unparsed', received_at: 5_000 });
    await addMessage(db, { status: 'parsed', received_at: 6_000 });
    expect(await unreadMessages(db)).toEqual([
      { id, receivedAt: 5_000, status: 'unparsed', reason: null },
    ]);
  });

  it('ignore hides the message for good', async () => {
    const id = await addMessage(db, { status: 'unparsed' });
    await dismissMessage(db, id, NOW);
    await dismissMessage(db, id, NOW);
    expect(await unreadMessages(db)).toEqual([]);
  });

  it('add by hand records an expense dated like the message and hides it', async () => {
    const id = await addMessage(db, { status: 'error', reason: 'boom', received_at: 7_000 });
    const txn = await addManualExpense(
      db,
      {
        name: 'ECG prepaid',
        amount: pesewas(6000),
        categoryId: 'rent',
        occurredAt: 1,
        sourceMessageId: id,
      },
      NOW,
    );
    expect(
      await db.get(
        'SELECT source_message_id AS s, occurred_at AS at FROM transactions WHERE id = ?',
        [txn],
      ),
    ).toEqual({ s: id, at: 7_000 });
    expect(await unreadMessages(db)).toEqual([]);
    await expect(
      addManualExpense(db, {
        name: 'again',
        amount: pesewas(1),
        categoryId: 'rent',
        occurredAt: 1,
        sourceMessageId: id,
      }),
    ).rejects.toThrow();
    await expect(
      addManualExpense(db, {
        name: 'x',
        amount: pesewas(1),
        categoryId: 'rent',
        occurredAt: 1,
        sourceMessageId: 99999,
      }),
    ).rejects.toThrow();
  });

  it('a hand-added expense never becomes a needs-a-note row', async () => {
    await addManualExpense(db, {
      name: 'x',
      amount: pesewas(1),
      categoryId: 'other',
      occurredAt: NOW,
    });
    expect(await needsNoteCount(db, null, NOW)).toBe(0);
  });
});

describe('after a restart', () => {
  it('keeps names and dismissals', async () => {
    const file = await createFileDb();
    try {
      await ingest(file.db, [toMaa('90000000061', 'for maa', T0)], NOW);
      await addName(file.db, 'family', 'maa');
      const kept = await addMessage(file.db, { status: 'unparsed' });
      const gone = await addMessage(file.db, { status: 'unparsed' });
      await dismissMessage(file.db, gone);

      const again = file.reopen();
      expect(await nameLists(again)).toEqual({ family: ['maa'], friend: [] });
      expect((await unreadMessages(again)).map((m) => m.id)).toEqual([kept]);
      expect(await catOf(again, '90000000061')).toBe('family');
    } finally {
      file.dispose();
    }
  });
});
