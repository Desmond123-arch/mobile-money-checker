import type { ImportPhase } from '@/backup/importStore';

export type StartRoute = '/(tabs)' | '/permission' | '/importing';

export interface StartFacts {
  /** meta.first_import_done is set. */
  firstImportDone: boolean;
  /** meta.onboarding_choice, null until the user picks "Not now". */
  onboardingChoice: 'not_now' | null;
  importPhase: ImportPhase;
}

export function decideStartRoute({
  firstImportDone,
  onboardingChoice,
  importPhase,
}: StartFacts): StartRoute {
  if (firstImportDone || onboardingChoice !== null) return '/(tabs)';
  if (importPhase === 'running') return '/importing';
  return '/permission';
}
