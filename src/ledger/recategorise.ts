import type { Db } from '@/data/db';
import type { MessageKind } from '@/domain/parse/types';

import { categorise, loadCategoriserContext } from './categorise';
import { ledgerQueue } from './writeQueue';

interface Row {
  id: number;
  kind: MessageKind;
  counterparty_name: string | null;
  counterparty_number: string | null;
  merchant_code: string | null;
  sms_reference: string | null;
  auto_category_id: number | null;
  auto_category_source: string | null;
  reference_clean: string | null;
  is_self_transfer: number;
}

/**
 * Re-runs the categoriser over every SMS transaction and overwrites the auto category. Manual tags
 * live in transaction_annotations, which this never reads or writes, so a blind overwrite is safe.
 * Runs inside the caller's transaction and outside the write queue, for callers already in both.
 */
export async function recategoriseIn(tx: Db): Promise<{ changed: number }> {
  const ctx = await loadCategoriserContext(tx);
  const rows = await tx.all<Row>(
    `SELECT id, kind, counterparty_name, counterparty_number, merchant_code, sms_reference,
       auto_category_id, auto_category_source, reference_clean, is_self_transfer
     FROM transactions WHERE origin = 'sms'`,
  );
  let changed = 0;
  for (const r of rows) {
    const c = categorise(
      {
        kind: r.kind,
        counterpartyName: r.counterparty_name,
        counterpartyNumber: r.counterparty_number,
        merchantCode: r.merchant_code,
        reference: r.sms_reference,
      },
      ctx,
    );
    const self = c.isSelfTransfer ? 1 : 0;
    // Each statement is a trip over the native bridge, so a row that already says the right thing
    // is skipped here instead of being sent to SQLite to be skipped there.
    if (
      r.auto_category_id === c.categoryId &&
      r.auto_category_source === c.source &&
      r.reference_clean === c.referenceClean &&
      r.is_self_transfer === self
    ) {
      continue;
    }
    const res = await tx.run(
      `UPDATE transactions SET auto_category_id = ?, auto_category_source = ?, reference_clean = ?,
         is_self_transfer = ?
       WHERE id = ?`,
      [c.categoryId, c.source, c.referenceClean, self, r.id],
    );
    changed += res.changes;
  }
  return { changed };
}

/** Call after any change to keywords, names, rules or categories. One transaction, so readers never see half. */
export function recategorise(db: Db): Promise<{ changed: number }> {
  return ledgerQueue.run(() => db.transaction(recategoriseIn));
}
