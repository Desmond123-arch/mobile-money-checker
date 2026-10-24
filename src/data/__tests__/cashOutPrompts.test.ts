import { monthRange } from '@/domain/calendar/month';

import { setMeta } from '../meta';
import { cashOutPrompts, monthSummary } from '../queries';
import { addTxn, annotate, categoryId, setup } from './fixtures';

const at = (day: number, hour = 12) => Date.UTC(2026, 9, day, hour);
const OCT = monthRange('2026-10');
const NOW = at(20, 15);
const DAY = 86_400_000;

describe('cashOutPrompts', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  let cash: number;
  const cashOut = (over: Record<string, number | string> = {}) =>
    addTxn(db, {
      kind: 'cash_out',
      counterparty_name: 'Balomi Ventures',
      auto_category_id: cash,
      auto_category_source: 'default',
      ...over,
    });
  const ids = async (now = NOW, range: typeof OCT | null = OCT) =>
    (await cashOutPrompts(db, range, now)).map((r) => r.row.id);

  beforeEach(async () => {
    db = await setup();
    cash = await categoryId(db, 'cash');
    await setMeta(db, 'first_import_at', String(at(10)));
  });
  afterEach(() => db.close());

  it('asks about a cash-out after the first import, newest first', async () => {
    const older = await cashOut({ occurred_at: at(11) });
    const newer = await cashOut({ occurred_at: at(15) });
    expect(await ids()).toEqual([String(newer), String(older)]);
  });

  it('leaves history and other kinds alone', async () => {
    await cashOut({ occurred_at: at(9) });
    await addTxn(db, { occurred_at: at(15) });
    await addTxn(db, { flow: 'income', kind: 'payment_in', occurred_at: at(15) });
    expect(await ids()).toEqual([]);
  });

  it('includes a cash-out at the first-import instant', async () => {
    const edge = await cashOut({ occurred_at: at(10) });
    expect(await ids()).toEqual([String(edge)]);
  });

  it('asks nothing before a first import is recorded', async () => {
    await cashOut({ occurred_at: at(15) });
    await db.run(`DELETE FROM meta WHERE key = 'first_import_at'`);
    expect(await ids()).toEqual([]);
  });

  it('is answered by a user note or a manual category, and by nothing else', async () => {
    const noted = await cashOut({ occurred_at: at(12) });
    await annotate(db, noted, { note: 'rent' });
    const tagged = await cashOut({ occurred_at: at(13) });
    await annotate(db, tagged, { category_id: await categoryId(db, 'food') });
    const open = await cashOut({ occurred_at: at(14) });
    await annotate(db, open, { prompt_snoozed_until: null });
    expect(await ids()).toEqual([String(open)]);
  });

  it('hides a snoozed cash-out until the snooze lapses', async () => {
    const id = await cashOut({ occurred_at: at(15) });
    await annotate(db, id, { prompt_snoozed_until: NOW + DAY });
    expect(await ids(NOW)).toEqual([]);
    expect(await ids(NOW + DAY - 1)).toEqual([]);
    expect(await ids(NOW + DAY)).toEqual([String(id)]);
  });

  it('filters by month, and counts toward the Home card', async () => {
    await cashOut({ occurred_at: at(15) });
    await cashOut({ occurred_at: Date.UTC(2026, 10, 2) });
    expect(await ids()).toHaveLength(1);
    expect(await ids(NOW, null)).toHaveLength(2);
    const summary = await monthSummary(db, '2026-10', '2026-10-20', NOW);
    expect(summary.needNote).toBe(1);
  });
});
