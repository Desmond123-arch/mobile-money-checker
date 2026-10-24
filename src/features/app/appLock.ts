// The app lock as a state machine. No React, Expo or SQLite, so every rule is a table test.

export const LOCK_GRACE_MS = 30_000;

export const NO_SCREEN_LOCK_NOTE = 'Set a screen lock in your phone’s settings first';

export type LockPhase = 'unlocked' | 'locked' | 'authenticating' | 'unavailable';

export type AuthResult = 'success' | 'cancelled' | 'failed' | 'unavailable';

export interface LockState {
  enabled: boolean;
  phase: LockPhase;
  /** Set only while unlocked and enabled: when the app left the foreground. */
  backgroundedAt: number | null;
  /** True when the lock screen should open the system prompt by itself (not after a cancel). */
  promptPending: boolean;
}

export type LockEvent =
  | { type: 'backgrounded'; at: number }
  | { type: 'foregrounded'; at: number }
  | { type: 'authStarted' }
  | { type: 'authFinished'; result: AuthResult }
  | { type: 'enabledChanged'; enabled: boolean };

/** Cold start: with the lock on the app starts locked and prompts at once. */
export const initLock = (enabled: boolean): LockState => ({
  enabled,
  phase: enabled ? 'locked' : 'unlocked',
  backgroundedAt: null,
  promptPending: enabled,
});

export function reduceLock(
  state: LockState,
  event: LockEvent,
  graceMs: number = LOCK_GRACE_MS,
): LockState {
  switch (event.type) {
    case 'backgrounded':
      return state.enabled && state.phase === 'unlocked'
        ? { ...state, backgroundedAt: event.at }
        : state;
    case 'foregrounded': {
      if (!state.enabled || state.phase !== 'unlocked' || state.backgroundedAt === null)
        return state;
      const away = event.at - state.backgroundedAt;
      // A negative gap means the clock moved back. Fail closed rather than skip the lock.
      const expired = away > graceMs || away < 0;
      return expired
        ? { ...state, phase: 'locked', backgroundedAt: null, promptPending: true }
        : { ...state, backgroundedAt: null };
    }
    case 'authStarted':
      return state.phase === 'locked' || state.phase === 'unavailable'
        ? { ...state, phase: 'authenticating', promptPending: false }
        : state;
    case 'authFinished': {
      if (state.phase !== 'authenticating') return state;
      if (event.result === 'success') return { ...state, phase: 'unlocked', backgroundedAt: null };
      return { ...state, phase: event.result === 'unavailable' ? 'unavailable' : 'locked' };
    }
    case 'enabledChanged':
      // Settings changes the flag only after a successful authentication, so the user stays in.
      return {
        ...state,
        enabled: event.enabled,
        phase: 'unlocked',
        backgroundedAt: null,
        promptPending: false,
      };
  }
}

/** The lock screen replaces the app in every phase except unlocked. */
export const showsLockScreen = (state: LockState): boolean =>
  state.enabled && state.phase !== 'unlocked';
