import type { Db } from '../db';
import { pesewas, type Pesewas } from '@/domain/money';

export interface MonthTotals {
  /** `YYYY-MM`, UTC. */
  monthId: string;
  spent: Pesewas;
  moneyIn: Pesewas;
}

/** Every month that has at least one ledger line, oldest first. */
export async function monthsWithData(db: Db): Promise<MonthTotals[]> {
  const rows = await db.all<{ month: string; spent: number; money_in: number }>(
    `SELECT strftime('%Y-%m', at / 1000, 'unixepoch') AS month,
            COALESCE(SUM(CASE WHEN bucket = 'spend' THEN pesewas END), 0) AS spent,
            COALESCE(SUM(CASE WHEN bucket = 'income' THEN pesewas END), 0) AS money_in
     FROM ledger_lines GROUP BY month ORDER BY month`,
  );
  return rows.map((r) => ({
    monthId: r.month,
    spent: pesewas(r.spent),
    moneyIn: pesewas(r.money_in),
  }));
}
