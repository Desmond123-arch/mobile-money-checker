import type { ImportPhase } from '@/backup/importStore';

export type StartRoute = '/(tabs)' | '/permission' | '/importing';

export interface StartFacts {
  /** meta.first_import_done is set. */
  firstImportDone: boolean;
  /** meta.onboarding_choice, null until the user picks "Not now". */
  onboardingChoice: 'not_now' | null;
  importPhase: ImportPhase;
  /** READ_SMS is granted. Granted with no finished import means a scan was cut short. */
  smsGranted: boolean;
}

export function decideStartRoute({
  firstImportDone,
  onboardingChoice,
  importPhase,
  smsGranted,
}: StartFacts): StartRoute {
  if (firstImportDone || onboardingChoice !== null) return '/(tabs)';
  if (importPhase === 'running' || smsGranted) return '/importing';
  return '/permission';
}
