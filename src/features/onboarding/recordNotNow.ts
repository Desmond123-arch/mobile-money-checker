import type { Db } from '@/data/db';
import { setMeta } from '@/data/meta';

/** Without this the first-run gate would send the user back to Permission on every launch. */
export const recordNotNow = (db: Db) => setMeta(db, 'onboarding_choice', 'not_now');
