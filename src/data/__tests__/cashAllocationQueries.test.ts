import { monthRange } from '@/domain/calendar/month';

import { setMeta } from '../meta';
import {
  cashOutBreakdown,
  cashOutLefts,
  cashOutPrompts,
  monthSummary,
  openCashOut,
} from '../queries';
import { addTxn, categoryId, setup } from './fixtures';

const at = (day: number, hour = 12) => Date.UTC(2026, 9, day, hour);
const OCT = monthRange('2026-10');
const NOW = at(20, 15);
const DAY = 86_400_000;

let db: Awaited<ReturnType<typeof setup>>;

const cashOut = async (over: Record<string, number | string> = {}) =>
  addTxn(db, {
    kind: 'cash_out',
    amount_pesewas: 10_000,
    counterparty_name: 'Balomi Ventures',
    auto_category_id: await categoryId(db, 'cash'),
    auto_category_source: 'default',
    occurred_at: at(15),
    ...over,
  });

const allocate = async (
  txn: number,
  key: string,
  amount: number,
  spentOn = at(16),
  note?: string,
) =>
  (
    await db.run(
      `INSERT INTO cash_allocations (cash_out_txn_id, category_id, amount_pesewas, note, spent_on,
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 1)`,
      [txn, await categoryId(db, key), amount, note ?? null, spentOn],
    )
  ).lastInsertRowId;

beforeEach(async () => {
  db = await setup();
  await setMeta(db, 'first_import_at', String(at(10)));
});
afterEach(() => db.close());

describe('cashOutPrompts with allocations', () => {
  it('stops asking once there is one allocation, even a small one', async () => {
    const id = await cashOut();
    expect((await cashOutPrompts(db, OCT, NOW)).map((r) => r.row.id)).toEqual([String(id)]);
    expect((await monthSummary(db, '2026-10', '2026-10-20', NOW)).needNote).toBe(1);
    await allocate(id, 'food', 100);
    expect(await cashOutPrompts(db, OCT, NOW)).toEqual([]);
    expect((await monthSummary(db, '2026-10', '2026-10-20', NOW)).needNote).toBe(0);
  });

  it('asks again when the last allocation is deleted', async () => {
    const id = await cashOut();
    const a = await allocate(id, 'food', 100);
    await db.run('DELETE FROM cash_allocations WHERE id = ?', [a]);
    expect(await cashOutPrompts(db, OCT, NOW)).toHaveLength(1);
  });

  it('keeps the snooze and the first-import cut-off', async () => {
    await cashOut({ occurred_at: at(9) });
    const other = await cashOut({ occurred_at: at(12) });
    await db.run(
      `INSERT INTO transaction_annotations (transaction_id, prompt_snoozed_until, updated_at)
       VALUES (?, ?, 1)`,
      [other, NOW + DAY],
    );
    expect(await cashOutPrompts(db, OCT, NOW)).toEqual([]);
  });
});

describe('cashOutBreakdown', () => {
  it('lists entries newest spending day first with the total and what is left', async () => {
    const id = await cashOut();
    const first = await allocate(id, 'food', 3_000, at(16), 'bread');
    const second = await allocate(id, 'transport', 2_000, at(18));
    expect(await cashOutBreakdown(db, id)).toEqual({
      id,
      amount: 10_000,
      occurredAt: at(15),
      counterparty: 'Balomi Ventures',
      allocations: [
        { id: second, categoryId: 'transport', amount: 2_000, note: null, spentOn: at(18) },
        { id: first, categoryId: 'food', amount: 3_000, note: 'bread', spentOn: at(16) },
      ],
      allocated: 5_000,
      left: 5_000,
    });
  });

  it('names an unnamed cash-out and is null for anything else', async () => {
    const merchant = await cashOut({ counterparty_name: null as unknown as string });
    expect((await cashOutBreakdown(db, merchant))!.counterparty).toBe('Cash out');
    const withCode = await cashOut({
      counterparty_name: null as unknown as string,
      merchant_code: '123',
    });
    expect((await cashOutBreakdown(db, withCode))!.counterparty).toBe('Merchant 123');
    const payment = await addTxn(db, { occurred_at: at(15) });
    expect(await cashOutBreakdown(db, payment)).toBeNull();
    expect(await cashOutBreakdown(db, 9_999)).toBeNull();
    const retracted = await cashOut({ retracted_at: 5 });
    expect(await cashOutBreakdown(db, retracted)).toBeNull();
  });
});

describe('cashOutLefts and openCashOut', () => {
  it('reports each cash-out in the range', async () => {
    const a = await cashOut();
    const b = await cashOut({ occurred_at: at(16) });
    await cashOut({ occurred_at: Date.UTC(2026, 8, 20) });
    await allocate(a, 'food', 10_000);
    await allocate(b, 'food', 4_000);
    expect((await cashOutLefts(db, OCT)).sort((x, y) => x.id - y.id)).toEqual([
      { id: a, allocated: 10_000, left: 0 },
      { id: b, allocated: 4_000, left: 6_000 },
    ]);
  });

  it('finds the newest cash-out of the last 30 days with something left', async () => {
    expect(await openCashOut(db, NOW)).toBeNull();
    const old = await cashOut({ occurred_at: NOW - 31 * DAY });
    expect(old).toBeGreaterThan(0);
    expect(await openCashOut(db, NOW)).toBeNull();
    const done = await cashOut({ occurred_at: at(19) });
    await allocate(done, 'food', 10_000, at(19));
    const partly = await cashOut({ occurred_at: at(17) });
    await allocate(partly, 'food', 2_500, at(17));
    expect(await openCashOut(db, NOW)).toEqual({ id: partly, left: 7_500 });
    await cashOut({ occurred_at: NOW + DAY });
    expect(await openCashOut(db, NOW)).toEqual({ id: partly, left: 7_500 });
  });
});
