import type { Db } from '@/data/db';
import { getMeta, setMeta } from '@/data/meta';

import type { LockAuth } from './lockAuth';

export type LockChange = 'enabled' | 'disabled' | 'cancelled' | 'unavailable';

export const loadLockEnabled = async (db: Db): Promise<boolean> =>
  (await getMeta(db, 'app_lock_enabled')) === '1';

/**
 * Turning the lock on or off needs a successful authentication first, so a user cannot lock
 * themselves out with a credential they cannot supply.
 */
export async function changeLock(db: Db, auth: LockAuth, next: boolean): Promise<LockChange> {
  if (next && !(await auth.isAvailable())) return 'unavailable';
  const result = await auth.authenticate();
  // With no screen lock left there is nothing to prove, and nothing to lock behind: allow off.
  if (result === 'unavailable' && !next) {
    await setMeta(db, 'app_lock_enabled', '0');
    return 'disabled';
  }
  if (result === 'unavailable') return 'unavailable';
  if (result !== 'success') return 'cancelled';
  await setMeta(db, 'app_lock_enabled', next ? '1' : '0');
  return next ? 'enabled' : 'disabled';
}
