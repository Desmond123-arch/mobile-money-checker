import { NO_SCREEN_LOCK_NOTE } from '@/features/app/appLock';

export const LOCK_ROW_HINT = 'Ask for your fingerprint, face or screen lock when you open the app';

/** A lock that is already on stays switchable, so the user can always turn it off. */
export const lockToggleDisabled = (available: boolean | null, enabled: boolean): boolean =>
  available === false && !enabled;

export const lockRowSubtitle = (available: boolean | null, enabled: boolean): string =>
  lockToggleDisabled(available, enabled) ? NO_SCREEN_LOCK_NOTE : LOCK_ROW_HINT;
