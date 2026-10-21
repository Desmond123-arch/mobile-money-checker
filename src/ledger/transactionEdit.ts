import type { Db } from '@/data/db';
import { normaliseWord } from '@/domain/category/word';

import { requireCategoryRowId } from './categoryRef';
import { recategoriseIn } from './recategorise';
import { ledgerQueue } from './writeQueue';

/** A field left out is untouched. Everything here is the user's, so it lands in transaction_annotations. */
export interface TransactionEdit {
  /** UI category id: the manual tag. */
  categoryId?: string;
  /** `''` clears the SMS reference's note; any other text is trimmed. */
  note?: string;
  /** "Ask me later" on a prompt. */
  promptSnoozedUntil?: number;
  /** With `categoryId`: also file every payment to this recipient there from now on. */
  alwaysTag?: boolean;
}

interface Annotation {
  category_id: number | null;
  note: string | null;
  prompt_snoozed_until: number | null;
}

interface Subject {
  origin: 'sms' | 'manual';
  flow: 'spend' | 'income' | 'credit';
  counterparty_name: string | null;
  counterparty_number: string | null;
  merchant_code: string | null;
}

/**
 * The most specific identity the message gave. A number or merchant code is exact; a name is the
 * fallback and is compared normalised, as the categoriser does.
 */
function recipientKey(
  s: Subject,
): { field: 'number' | 'merchant_code' | 'name'; value: string } | null {
  if (s.counterparty_number) return { field: 'number', value: s.counterparty_number };
  if (s.merchant_code) return { field: 'merchant_code', value: s.merchant_code };
  const name = s.counterparty_name === null ? '' : normaliseWord(s.counterparty_name);
  return name === '' ? null : { field: 'name', value: name };
}

/**
 * One user action on one transaction, in one transaction. Returns whether a recipient rule was
 * saved (it cannot be for a hand-added expense, a refund, or a message with no sender identity).
 */
export async function editTransaction(
  db: Db,
  transactionId: number,
  edit: TransactionEdit,
  now: number = Date.now(),
): Promise<{ ruleSaved: boolean }> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      const subject = await tx.get<Subject>(
        `SELECT origin, flow, counterparty_name, counterparty_number, merchant_code
         FROM transactions WHERE id = ? AND retracted_at IS NULL`,
        [transactionId],
      );
      if (subject === null) throw new Error(`no transaction ${transactionId}`);

      const old = await tx.get<Annotation>(
        `SELECT category_id, note, prompt_snoozed_until FROM transaction_annotations
         WHERE transaction_id = ?`,
        [transactionId],
      );
      const categoryRow =
        edit.categoryId === undefined ? undefined : await requireCategoryRowId(tx, edit.categoryId);
      const next: Annotation = {
        category_id: categoryRow ?? old?.category_id ?? null,
        note: edit.note === undefined ? (old?.note ?? null) : edit.note.trim(),
        prompt_snoozed_until: edit.promptSnoozedUntil ?? old?.prompt_snoozed_until ?? null,
      };
      await tx.run(
        `INSERT INTO transaction_annotations
           (transaction_id, category_id, note, prompt_snoozed_until, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(transaction_id) DO UPDATE SET category_id = excluded.category_id,
           note = excluded.note, prompt_snoozed_until = excluded.prompt_snoozed_until,
           updated_at = excluded.updated_at`,
        [transactionId, next.category_id, next.note, next.prompt_snoozed_until, now],
      );

      const key = recipientKey(subject);
      if (!edit.alwaysTag || categoryRow === undefined || key === null) return { ruleSaved: false };
      if (subject.origin !== 'sms' || subject.flow === 'credit') return { ruleSaved: false };
      await tx.run(
        `INSERT INTO recipient_rules
           (match_field, match_value, applies_to, category_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(match_field, match_value, applies_to) DO UPDATE SET
           category_id = excluded.category_id, updated_at = excluded.updated_at`,
        [key.field, key.value, subject.flow, categoryRow, now, now],
      );
      await recategoriseIn(tx);
      return { ruleSaved: true };
    }),
  );
}
