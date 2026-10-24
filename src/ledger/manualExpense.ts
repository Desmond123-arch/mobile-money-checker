import type { Db } from '@/data/db';
import type { Pesewas } from '@/domain/money';

import { requireCategoryRowId } from './categoryRef';
import { ledgerQueue } from './writeQueue';

export interface NewManualExpense {
  /** The "What was it for?" title. */
  name: string;
  amount: Pesewas;
  /** UI category id. */
  categoryId: string;
  occurredAt: number;
  /** "Add by hand" on an unread message: links the expense to it and takes the message's time. */
  sourceMessageId?: number;
}

/** Records cash or any spend MoMo sent no message for. Returns the new transaction id. */
export async function addManualExpense(
  db: Db,
  input: NewManualExpense,
  now: number = Date.now(),
): Promise<number> {
  const name = input.name.trim();
  if (name === '') throw new Error('an expense needs a name');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error('an expense needs a positive amount');
  }
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      const categoryId = await requireCategoryRowId(tx, input.categoryId);
      let occurredAt = input.occurredAt;
      if (input.sourceMessageId !== undefined) {
        const message = await tx.get<{ received_at: number }>(
          'SELECT received_at FROM sms_messages WHERE id = ?',
          [input.sourceMessageId],
        );
        if (message === null) throw new Error('that message is not stored');
        occurredAt = message.received_at;
      }
      const { lastInsertRowId: id } = await tx.run(
        `INSERT INTO transactions (origin, source_message_id, flow, kind, amount_pesewas,
           counterparty_name, occurred_at, occurred_at_source, created_at, updated_at)
         VALUES ('manual', ?, 'spend', 'manual', ?, ?, ?, 'user', ?, ?)`,
        [input.sourceMessageId ?? null, input.amount, name, occurredAt, now, now],
      );
      await tx.run(
        `INSERT INTO transaction_annotations (transaction_id, category_id, updated_at)
         VALUES (?, ?, ?)`,
        [id, categoryId, now],
      );
      return id;
    }),
  );
}
