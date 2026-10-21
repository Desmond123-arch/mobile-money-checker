import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';

import { useDb } from './DbProvider';
import { nativeSms } from '@/scan';

import { loadStartRoute } from './loadStartRoute';

/**
 * Picks the first screen once per launch, while the splash is still up so Home never flashes.
 * It only acts when the app opened on the root index; a deep link or restored screen stays put.
 */
export function FirstRunGate() {
  const db = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const navigationReady = useRootNavigationState()?.key !== undefined;
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !navigationReady) return;
    decided.current = true;
    const landedOnRoot = pathname === '/';
    (async () => {
      if (landedOnRoot) router.replace(await loadStartRoute(db, nativeSms));
    })()
      // A failed read must not strand the user behind the splash; Home is the safe landing.
      .catch(() => undefined)
      .finally(() => {
        requestAnimationFrame(() => void SplashScreen.hideAsync());
      });
  }, [db, navigationReady, pathname, router]);

  return null;
}
