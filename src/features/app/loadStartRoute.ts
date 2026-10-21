import { getImportState } from '@/backup/importStore';
import type { Db } from '@/data/db';
import { getMeta } from '@/data/meta';

import { decideStartRoute, type StartRoute } from './startRoute';

export async function loadStartRoute(db: Db): Promise<StartRoute> {
  const [done, choice] = await Promise.all([
    getMeta(db, 'first_import_done'),
    getMeta(db, 'onboarding_choice'),
  ]);
  return decideStartRoute({
    firstImportDone: done === '1',
    onboardingChoice: choice === 'not_now' ? 'not_now' : null,
    importPhase: getImportState().phase,
  });
}
