import { formatGhs, pesewas } from '@/domain/money';
import type { ImportSummary } from '@/ledger/importSummary';

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function summaryLine(s: ImportSummary): string {
  const counts = `${s.transactions.toLocaleString('en-GH')} transactions, ${s.payments.toLocaleString('en-GH')} payments.`;
  if (s.latestMonth === null) return counts;
  return `${counts} Spent in ${monthLabel(s.latestMonth)}: ${formatGhs(pesewas(s.monthSpendPesewas))}.`;
}
