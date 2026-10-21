import * as LocalAuthentication from 'expo-local-authentication';

import type { AuthResult } from './appLock';

/** The only file that imports expo-local-authentication. */
export interface LockAuth {
  /** True when the phone has a screen lock or an enrolled biometric to unlock with. */
  isAvailable(): Promise<boolean>;
  authenticate(): Promise<AuthResult>;
}

export const PROMPT_MESSAGE = 'Unlock MoMo Spend';

const UNAVAILABLE_ERRORS = new Set(['not_enrolled', 'passcode_not_set', 'not_available']);
const CANCELLED_ERRORS = new Set(['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback']);

export const expoLockAuth: LockAuth = {
  async isAvailable() {
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      return level !== LocalAuthentication.SecurityLevel.NONE;
    } catch {
      return false;
    }
  },
  async authenticate() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: PROMPT_MESSAGE,
        disableDeviceFallback: false,
      });
      if (result.success) return 'success';
      if (UNAVAILABLE_ERRORS.has(result.error)) return 'unavailable';
      return CANCELLED_ERRORS.has(result.error) ? 'cancelled' : 'failed';
    } catch {
      // A build without the native module cannot ask. Stay locked.
      return 'failed';
    }
  },
};
