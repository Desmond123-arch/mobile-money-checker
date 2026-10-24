import { addTxn, categoryId, setup } from '@/data/__tests__/fixtures';
import type { Db } from '@/data/db';
import { addKeyword } from '../categories';
import { addName } from '../names';
import { recategoriseIn } from '../recategorise';

const ROWS = 1_640;

/** Counts every statement a caller sends, which on a phone is one trip over the native bridge each. */
function counting(db: Db) {
  const counts = { run: 0, all: 0, get: 0 };
  const wrap = (inner: Db): Db => ({
    exec: (sql) => inner.exec(sql),
    run: (sql, params) => (counts.run++, inner.run(sql, params)),
    all: (sql, params) => (counts.all++, inner.all(sql, params)),
    get: (sql, params) => (counts.get++, inner.get(sql, params)),
    transaction: (fn) => inner.transaction((tx) => fn(wrap(tx))),
  });
  return { db: wrap(db), counts };
}

let db: Db;
beforeEach(async () => {
  db = await setup();
  const misc = await categoryId(db, 'misc');
  for (let i = 0; i < ROWS; i++) {
    await addTxn(db, {
      counterparty_name: `SHOP ${i % 40}`,
      sms_reference: i % 50 === 0 ? 'for maa' : `item ${i}`,
      auto_category_id: misc,
      auto_category_source: 'default',
    });
  }
  // The first pass settles rows that were never categorised; later passes are the everyday case.
  await db.transaction(recategoriseIn);
});

describe('recategorising a large history', () => {
  it('writes only the rows whose category changes', async () => {
    const { db: counted, counts } = counting(db);
    await counted.transaction(recategoriseIn);
    expect(counts.run).toBeLessThanOrEqual(5);
  });

  it('adding a name that matches nothing writes no transaction rows at all', async () => {
    const { db: counted, counts } = counting(db);
    const res = await addName(counted, 'family', 'zzyzx');
    expect(res).toMatchObject({ ok: true, added: true, changed: 0 });
    expect(counts.run).toBe(1);
  });

  it('adding a name that matches some rows writes exactly those rows', async () => {
    const { db: counted, counts } = counting(db);
    const res = await addName(counted, 'family', 'maa');
    const matching = Math.ceil(ROWS / 50);
    expect(res).toMatchObject({ ok: true, added: true, changed: matching });
    expect(counts.run).toBe(1 + matching);
    const family = await categoryId(db, 'family');
    const filed = await db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions WHERE auto_category_id = ?',
      [family],
    );
    expect(filed?.n).toBe(matching);
  });

  it('a second run over unchanged data writes nothing', async () => {
    await addName(db, 'family', 'maa');
    const { db: counted, counts } = counting(db);
    expect((await counted.transaction(recategoriseIn)).changed).toBe(0);
    expect(counts.run).toBe(0);
  });

  it('adding a word reports how many payments it moved, and writes only those', async () => {
    const { db: counted, counts } = counting(db);
    const res = await addKeyword(counted, 'food', 'item 7');
    expect(res).toMatchObject({ ok: true, added: true, changed: 1 });
    expect(counts.run).toBe(2);
  });

  it('removing a name that was never added changes nothing', async () => {
    const { removeName } = await import('../names');
    expect(await removeName(db, 'family', 'nobody')).toBe(0);
  });
});
