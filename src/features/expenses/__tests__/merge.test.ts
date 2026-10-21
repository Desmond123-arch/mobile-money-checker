import { pesewas } from '@/domain/money';
import { buildMonthSummary } from '@/domain/summary/month';
import type { TransactionRow } from '@/domain/transaction/transaction';

import type { AddedExpense } from '../ExpensesProvider';
import {
  addedIso,
  matchesFilter,
  mergeRows,
  mergeSpend,
  mergeSummary,
  recentWithAdded,
} from '../merge';

const TODAY = new Date('2026-10-20T10:00:00Z');

const row = (id: string, over: Partial<TransactionRow> = {}): TransactionRow => ({
  id,
  counterparty: id,
  categoryId: 'food',
  note: null,
  direction: 'out',
  amount: pesewas(1000),
  ...over,
});

const expense = (day: 'today' | 'yesterday', name: string, cedis: number, categoryId = 'food') =>
  ({
    day,
    row: row(`manual-${name}`, {
      counterparty: name,
      categoryId,
      amount: pesewas(cedis * 100),
      manual: true,
    }),
  }) satisfies AddedExpense;

describe('expense merge layer', () => {
  it('dates added expenses relative to today', () => {
    expect(addedIso('today', TODAY)).toBe('2026-10-20');
    expect(addedIso('yesterday', TODAY)).toBe('2026-10-19');
  });

  it('adds to the month total and payment count only', () => {
    const base = buildMonthSummary({
      monthId: '2026-10',
      isCurrent: true,
      elapsedDays: 20,
      spent: pesewas(5000),
      moneyIn: pesewas(0),
      payments: 2,
      needNote: 0,
      spendByDay: new Map(),
      previous: null,
    });
    const merged = mergeSummary(base, [expense('today', 'Lunch', 12), expense('today', 'Taxi', 8)]);
    expect(merged).toMatchObject({ spent: 7000, payments: 4, daily: base.daily });
  });

  it('adds to a category or opens a new one', () => {
    const spend = [{ categoryId: 'food', amount: pesewas(5000) }];
    expect(
      mergeSpend(spend, [expense('today', 'Lunch', 12), expense('today', 'Bus', 3, 'transport')]),
    ).toEqual([
      { categoryId: 'food', amount: 6200 },
      { categoryId: 'transport', amount: 300 },
    ]);
    expect(
      mergeSpend([], [{ day: 'today', row: row('m', { categoryId: null, amount: pesewas(100) }) }]),
    ).toEqual([{ categoryId: 'other', amount: 100 }]);
  });

  it('puts added expenses first within their day, newest day first', () => {
    const stored = [
      { iso: '2026-10-20', row: row('a') },
      { iso: '2026-10-19', row: row('b') },
    ];
    const merged = mergeRows(
      stored,
      [expense('yesterday', 'Y', 1), expense('today', 'T', 1)],
      TODAY,
      () => true,
    );
    expect(merged.map((m) => m.row.counterparty)).toEqual(['T', 'a', 'Y', 'b']);
    expect(mergeRows(stored, [expense('today', 'T', 1)], TODAY, () => false)).toEqual(stored);
  });

  it('takes the newest few for Recent with a day word', () => {
    const recent = recentWithAdded(
      [{ iso: '2026-10-18', row: row('old') }],
      [expense('today', 'Lunch', 12)],
      TODAY,
      3,
    );
    expect(recent.map((r) => [r.row.counterparty, r.when])).toEqual([
      ['Lunch', 'Today'],
      ['old', 'Sun 18 Oct'],
    ]);
  });

  it('filters like the SQL: direction, category, then search over name, note and category', () => {
    const name = (id: string | null) => (id === 'food' ? 'Food' : 'Other');
    const f = { direction: null, categoryId: null, search: '', categoryName: name };
    const r = row('x', { counterparty: 'Kojo', note: 'rice' });
    expect(matchesFilter(r, f)).toBe(true);
    expect(matchesFilter(r, { ...f, direction: 'in' })).toBe(false);
    expect(matchesFilter(r, { ...f, categoryId: 'transport' })).toBe(false);
    expect(matchesFilter(r, { ...f, search: ' RICE ' })).toBe(true);
    expect(matchesFilter(r, { ...f, search: 'food' })).toBe(true);
    expect(matchesFilter(r, { ...f, search: 'zzz' })).toBe(false);
  });
});
