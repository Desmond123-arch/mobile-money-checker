import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getMeta } from '@/data/meta';
import { nativeSms, startScanTriggers, type ScanOutcome, type SmsPermissionStatus } from '@/scan';

import { useDb } from './DbProvider';
import { createScanController } from './scanController';

export interface ScanApi {
  /** null until read, and when this build has no SMS module (Expo Go). */
  permission: SmsPermissionStatus | null;
  scan(): Promise<ScanOutcome>;
  /** Reads the status without asking, so it never opens the system dialog. */
  refresh(): Promise<SmsPermissionStatus | null>;
  /** Shows the system dialog when it can. Resolves null when the module is missing. */
  requestPermission(): Promise<SmsPermissionStatus | null>;
  /** Starts the scan that follows a grant and says where to go: Importing, or back to the app. */
  afterGrant(): Promise<'/importing' | '/(tabs)'>;
}

const ScanContext = createContext<ScanApi | null>(null);

export function useScan(): ScanApi {
  const api = useContext(ScanContext);
  if (!api) throw new Error('useScan needs a ScanProvider above it');
  return api;
}

const readStatus = (): Promise<SmsPermissionStatus | null> =>
  nativeSms.getPermissionStatus().catch(() => null);

/**
 * Owns the one scanner of the process and the cold start and foreground triggers. The inbox
 * observer is attached by the triggers once a scan has seen the permission granted.
 */
export function ScanProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<SmsPermissionStatus | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const status = await readStatus();
    if (alive.current) setPermission(status);
    return status;
  }, []);

  const controller = useMemo(
    () =>
      createScanController({
        db,
        sms: nativeSms,
        onChanged: () => void queryClient.invalidateQueries(),
      }),
    [db, queryClient],
  );

  useEffect(() => {
    alive.current = true;
    const scan = async () => {
      const outcome = await controller.scan();
      void refresh();
      return outcome;
    };
    const triggers = startScanTriggers({ scan, sms: nativeSms, appState: AppState });
    void triggers.run();
    return () => {
      alive.current = false;
      triggers.stop();
    };
  }, [controller, refresh]);

  const api = useMemo<ScanApi>(
    () => ({
      permission,
      scan: controller.scan,
      refresh,
      requestPermission: async () => {
        const status = await nativeSms.requestPermission().catch(() => null);
        await refresh();
        return status;
      },
      afterGrant: async () => {
        const done = (await getMeta(db, 'first_import_done').catch(() => null)) === '1';
        if (done) {
          void controller.scan();
          return '/(tabs)';
        }
        void controller.scanFirst();
        return '/importing';
      },
    }),
    [permission, controller, db, refresh],
  );

  return <ScanContext.Provider value={api}>{children}</ScanContext.Provider>;
}
