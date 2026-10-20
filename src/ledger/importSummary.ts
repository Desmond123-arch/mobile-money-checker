import type { Db } from '@/data/db';

export interface ImportSummary {
  transactions: number;
  payments: number;
  /** 'YYYY-MM' (UTC) of the latest month that has spend, or null when there is none. */
  latestMonth: string | null;
  /** Net spend for that month from ledger_lines: amounts, fees and tax, less linked refunds. */
  monthSpendPesewas: number;
}

export async function importSummary(db: Db): Promise<ImportSummary> {
  const counts = await db.get<{ transactions: number; payments: number }>(
    `SELECT COUNT(*) AS transactions, COALESCE(SUM(flow = 'spend'), 0) AS payments
     FROM transactions WHERE retracted_at IS NULL`,
  );
  const latest = await db.get<{ month: string | null }>(
    `SELECT strftime('%Y-%m', MAX(at) / 1000, 'unixepoch') AS month
     FROM ledger_lines WHERE bucket = 'spend'`,
  );
  const month = latest?.month ?? null;
  const spend = month
    ? await db.get<{ total: number }>(
        `SELECT COALESCE(SUM(pesewas), 0) AS total FROM ledger_lines
         WHERE bucket = 'spend' AND strftime('%Y-%m', at / 1000, 'unixepoch') = ?`,
        [month],
      )
    : null;
  return {
    transactions: counts?.transactions ?? 0,
    payments: counts?.payments ?? 0,
    latestMonth: month,
    monthSpendPesewas: spend?.total ?? 0,
  };
}
