import type { Db } from '@/data/db';
import type { Pesewas } from '@/domain/money';
import { linkReversals, type Link, type ProjectedTxn } from '@/domain/parse/reversal';
import { PARSER_VERSION, type MessageKind } from '@/domain/parse/types';

import { recategoriseIn } from './recategorise';

interface TxnRow {
  id: number;
  momo_txn_id: string;
  kind: MessageKind;
  amount_pesewas: number;
  counterparty_name: string | null;
  occurred_at: number;
}

interface LinkRow {
  credit: string;
  original: string | null;
}

/**
 * Links every credit that has no link row yet (all of them, not only this run's, so a crash
 * between batches and here cannot leave a reversal unlinked for good). Existing links, user links
 * included, are never touched. Runs inside the caller's transaction.
 */
export async function linkUnlinkedCredits(tx: Db, now: number): Promise<number> {
  const txns = await tx.all<TxnRow>(
    `SELECT id, momo_txn_id, kind, amount_pesewas, counterparty_name, occurred_at
     FROM transactions
     WHERE origin = 'sms' AND retracted_at IS NULL AND flow IN ('spend','credit')`,
  );
  const links = await tx.all<LinkRow>(
    `SELECT c.momo_txn_id AS credit, o.momo_txn_id AS original
     FROM reversal_links l
     JOIN transactions c ON c.id = l.credit_txn_id
     LEFT JOIN transactions o ON o.id = l.original_txn_id`,
  );
  // A user link with no original ("there is none") still marks its credit as handled.
  const existing: Link[] = links.map((l) => ({
    reversalTxnId: l.credit,
    originalTxnId: l.original ?? '',
    ambiguous: false,
  }));
  const projected: ProjectedTxn[] = txns.map((t) => ({
    momoTxnId: t.momo_txn_id,
    kind: t.kind,
    amount: t.amount_pesewas as Pesewas,
    counterpartyName: t.counterparty_name,
    occurredAt: t.occurred_at,
  }));
  const ids = new Map(txns.map((t) => [t.momo_txn_id, t.id]));

  const fresh = linkReversals(projected, existing);
  for (const link of fresh) {
    await tx.run(
      `INSERT INTO reversal_links (credit_txn_id, original_txn_id, linked_by, confidence, created_at)
       VALUES (?, ?, 'auto', ?, ?) ON CONFLICT(credit_txn_id) DO NOTHING`,
      [
        ids.get(link.reversalTxnId)!,
        ids.get(link.originalTxnId)!,
        link.ambiguous ? 'ambiguous' : 'exact',
        now,
      ],
    );
  }
  return fresh.length;
}

/** Links reversals, marks the first import done, and recategorises. Safe to run again. */
export async function finishImport(db: Db, now: number = Date.now()): Promise<{ linked: number }> {
  return db.transaction(async (tx) => {
    const linked = await linkUnlinkedCredits(tx, now);

    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('first_import_done', '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('first_import_at', ?) ON CONFLICT(key) DO NOTHING`,
      [String(now)],
    );
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('last_import_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(now)],
    );
    await tx.run(
      `INSERT INTO meta (key, value) VALUES ('parser_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(PARSER_VERSION)],
    );
    // Keywords or names edited during a long import would otherwise leave earlier batches stale.
    await recategoriseIn(tx);
    return { linked };
  });
}
