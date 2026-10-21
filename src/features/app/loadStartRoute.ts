import { getImportState } from '@/backup/importStore';
import type { Db } from '@/data/db';
import { getMeta } from '@/data/meta';

import type { SmsSource } from '@/scan/types';

import { decideStartRoute, type StartRoute } from './startRoute';

export async function loadStartRoute(
  db: Db,
  sms: Pick<SmsSource, 'getPermissionStatus'>,
): Promise<StartRoute> {
  const [done, choice, permission] = await Promise.all([
    getMeta(db, 'first_import_done'),
    getMeta(db, 'onboarding_choice'),
    // A build without the module cannot have the permission, and must still reach Permission.
    Promise.resolve()
      .then(() => sms.getPermissionStatus())
      .catch(() => null),
  ]);
  return decideStartRoute({
    firstImportDone: done === '1',
    onboardingChoice: choice === 'not_now' ? 'not_now' : null,
    importPhase: getImportState().phase,
    smsGranted: permission === 'granted',
  });
}
