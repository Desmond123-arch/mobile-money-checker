import type { ImportSink } from '@/backup/startImport';
import type { Db } from '@/data/db';
import { finishImport } from '@/ledger/finishImport';
import { importSummary } from '@/ledger/importSummary';
import { ingest } from '@/ledger/ingest';
import { ledgerQueue } from '@/ledger/writeQueue';

/** One sink per import: it remembers payment ids so a payment whose two messages land in different batches counts once. */
export function createLedgerSink(db: Db): ImportSink {
  const seen = new Set<string>();
  return {
    ingestBatch: (messages) =>
      ledgerQueue.run(async () => {
        const result = await ingest(
          db,
          messages.map((m) => ({ source: 'backup', body: m.body, receivedAt: m.receivedAt })),
        );
        let fresh = 0;
        for (const id of result.paymentIds) {
          if (!seen.has(id)) {
            seen.add(id);
            fresh += 1;
          }
        }
        return { payments: fresh };
      }),
    finish: () =>
      ledgerQueue.run(async () => {
        await finishImport(db);
        return importSummary(db);
      }),
  };
}
