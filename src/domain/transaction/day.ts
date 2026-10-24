import { pesewas, type Pesewas } from '../money';
import { dayHeading } from './label';
import type { TransactionRow } from './transaction';

export interface DayGroup {
  /** `YYYY-MM-DD`, UTC. */
  iso: string;
  label: string;
  /** Money in less money out. */
  total: Pesewas;
  rows: TransactionRow[];
}

export interface DatedRow {
  iso: string;
  row: TransactionRow;
}

export const signedAmount = (row: TransactionRow): number =>
  row.direction === 'in' ? row.amount : -row.amount;

/** Groups rows that arrive newest first; keeps their order within a day. */
export function groupByDay(items: readonly DatedRow[], today: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const { iso, row } of items) {
    let group = groups.find((g) => g.iso === iso);
    if (group === undefined) {
      group = { iso, label: dayHeading(iso, today), total: pesewas(0), rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
    group.total = pesewas(group.total + signedAmount(row));
  }
  return groups;
}
