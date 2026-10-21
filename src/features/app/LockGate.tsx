import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { Button, FixedScreen } from '@/ui';
import { Headline, IconTile, Lede } from '@/features/onboarding/components/Parts';

import {
  initLock,
  NO_SCREEN_LOCK_NOTE,
  reduceLock,
  showsLockScreen,
  type LockEvent,
  type LockState,
} from './appLock';
import { changeLock, loadLockEnabled, type LockChange } from './appLockActions';
import { useDb } from './DbProvider';
import { expoLockAuth, type LockAuth } from './lockAuth';

interface AppLockValue {
  enabled: boolean;
  /** Null until the first check. False when the phone has no screen lock to unlock with. */
  available: boolean | null;
  change: (next: boolean) => Promise<LockChange>;
}

const AppLockContext = createContext<AppLockValue | null>(null);

export function useAppLock(): AppLockValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock needs a LockGate above it');
  return value;
}

/**
 * Sits inside DbProvider and above every screen. While locked it renders the lock screen instead
 * of its children, so no transaction is mounted behind it. It does nothing unless the user turned
 * the lock on in Settings.
 */
export function LockGate({
  children,
  auth = expoLockAuth,
}: {
  children: ReactNode;
  auth?: LockAuth;
}) {
  const db = useDb();
  const [initial, setInitial] = useState<boolean | null>(null);

  useEffect(() => {
    // A failed read must not lock the user out or strand them behind the splash.
    loadLockEnabled(db)
      .catch(() => false)
      .then(setInitial);
  }, [db]);

  if (initial === null) return null;
  return (
    <LockGateReady initialEnabled={initial} auth={auth}>
      {children}
    </LockGateReady>
  );
}

function LockGateReady({
  initialEnabled,
  auth,
  children,
}: {
  initialEnabled: boolean;
  auth: LockAuth;
  children: ReactNode;
}) {
  const db = useDb();
  const [state, dispatch] = useReducer(
    (s: LockState, e: LockEvent) => reduceLock(s, e),
    initialEnabled,
    initLock,
  );
  const [available, setAvailable] = useState<boolean | null>(null);
  const inFlight = useRef(false);

  const refreshAvailable = useCallback(() => {
    void auth.isAvailable().then(setAvailable);
  }, [auth]);

  const unlock = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'authStarted' });
    try {
      dispatch({ type: 'authFinished', result: await auth.authenticate() });
    } finally {
      inFlight.current = false;
    }
  }, [auth]);

  useEffect(() => {
    refreshAvailable();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') dispatch({ type: 'backgrounded', at: Date.now() });
      else if (next === 'active') {
        dispatch({ type: 'foregrounded', at: Date.now() });
        refreshAvailable();
      }
    });
    return () => sub.remove();
  }, [refreshAvailable]);

  useEffect(() => {
    if (state.phase === 'locked' && state.promptPending) void unlock();
  }, [state.phase, state.promptPending, unlock]);

  const change = useCallback(
    async (next: boolean) => {
      const outcome = await changeLock(db, auth, next);
      if (outcome === 'enabled') dispatch({ type: 'enabledChanged', enabled: true });
      if (outcome === 'disabled') dispatch({ type: 'enabledChanged', enabled: false });
      if (outcome === 'unavailable') setAvailable(false);
      return outcome;
    },
    [db, auth],
  );

  const value = useMemo(
    () => ({ enabled: state.enabled, available, change }),
    [state.enabled, available, change],
  );

  if (showsLockScreen(state)) {
    return (
      <LockScreen
        unavailable={state.phase === 'unavailable'}
        busy={state.phase === 'authenticating'}
        onUnlock={() => void unlock()}
      />
    );
  }
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

function LockScreen({
  unavailable,
  busy,
  onUnlock,
}: {
  unavailable: boolean;
  busy: boolean;
  onUnlock: () => void;
}) {
  // Children (and so FirstRunGate) are not mounted, so the splash is ours to lower.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <FixedScreen testID="lockScreen">
      <View className="flex-1 justify-between px-5 pb-1 pt-6">
        <View className="gap-5">
          <IconTile icon="lock" tone="signal" />
          <Headline>MoMo Spend is locked.</Headline>
          <Lede>Use your fingerprint, face or screen lock to open it.</Lede>
          {unavailable ? (
            <Text testID="lockUnavailableNote" className="font-inter text-body leading-6 text-ink">
              {NO_SCREEN_LOCK_NOTE}. Then tap Unlock.
            </Text>
          ) : null}
        </View>
        <Button testID="unlockBtn" label="Unlock" disabled={busy} onPress={onUnlock} />
      </View>
    </FixedScreen>
  );
}
