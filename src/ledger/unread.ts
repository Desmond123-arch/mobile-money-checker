import type { Db } from '@/data/db';

import { ledgerQueue } from './writeQueue';

/** "Ignore" on a message we could not read. Kept apart from the message's status, so a re-parse cannot bring it back. */
export function dismissMessage(db: Db, messageId: number, now: number = Date.now()): Promise<void> {
  return ledgerQueue.run(() =>
    db.transaction(async (tx) => {
      await tx.run(
        'INSERT INTO message_dismissals (message_id, dismissed_at) VALUES (?, ?) ON CONFLICT(message_id) DO NOTHING',
        [messageId, now],
      );
    }),
  );
}
