import { pesewas } from '@/domain/money';
import type { AddedExpense } from '@/features/expenses';

import { SAMPLE_DAYS, type DayGroup } from './sample';

const DAY_INDEX = { today: 0, yesterday: 1 } as const;

export function daysWithAdded(added: readonly AddedExpense[]): DayGroup[] {
  return SAMPLE_DAYS.map((group, index) => {
    const mine = added.filter((a) => DAY_INDEX[a.day] === index).map((a) => a.row);
    if (mine.length === 0) return group;
    const extra = mine.reduce((sum, r) => sum + r.amount, 0);
    return { ...group, total: pesewas(group.total - extra), rows: [...mine, ...group.rows] };
  });
}
