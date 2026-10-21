import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { SmsPermissionStatus } from '@/scan';

import { useScan } from './ScanProvider';

/**
 * Asks for SMS access. On a grant it starts the scan and moves to Importing (first run) or back
 * to the app. Every other answer is returned for the caller to show; null means this build has no
 * SMS module.
 */
export function useRequestSms(): () => Promise<SmsPermissionStatus | null> {
  const router = useRouter();
  const scan = useScan();
  return useCallback(async () => {
    const status = await scan.requestPermission();
    if (status === 'granted') router.replace(await scan.afterGrant());
    return status;
  }, [router, scan]);
}
