import type { ScanOutcome, SmsSource } from './types';

export interface AppStateLike {
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

export interface ScanTriggers {
  /** Runs a scan now. The cold-start trigger calls this once. */
  run(): Promise<ScanOutcome | null>;
  stop(): void;
}

/**
 * The scan triggers other than the manual button (system-design 7.1): the app returning to the
 * foreground and the inbox observer. The observer is attached only while the app is active and
 * only after a scan saw the permission granted, so it never registers without access.
 */
export function startScanTriggers(deps: {
  scan: () => Promise<ScanOutcome>;
  sms: Pick<SmsSource, 'addInboxChangedListener'>;
  appState: AppStateLike;
}): ScanTriggers {
  const { scan, sms, appState } = deps;
  let observer: { remove(): void } | null = null;
  let stopped = false;

  const detach = () => {
    observer?.remove();
    observer = null;
  };

  const run = async () => {
    const outcome = await scan().catch(() => null);
    const sawAccess = outcome?.status === 'ok' || outcome?.status === 'no_messages';
    if (sawAccess && !observer && !stopped) {
      observer = sms.addInboxChangedListener(() => void run());
    }
    return outcome;
  };

  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') void run();
    else detach();
  });

  return {
    run,
    stop() {
      stopped = true;
      subscription.remove();
      detach();
    },
  };
}
