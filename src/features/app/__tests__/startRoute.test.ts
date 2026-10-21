import type { ImportPhase } from '@/backup/importStore';

import { decideStartRoute, type StartRoute } from '../startRoute';

type Choice = 'not_now' | null;

// done, choice, phase, route. Every combination, spelled out.
const TABLE: [boolean, Choice, ImportPhase, StartRoute][] = [
  [true, 'not_now', 'idle', '/(tabs)'],
  [true, 'not_now', 'running', '/(tabs)'],
  [true, 'not_now', 'done', '/(tabs)'],
  [true, 'not_now', 'failed', '/(tabs)'],
  [true, 'not_now', 'cancelled', '/(tabs)'],
  [true, null, 'idle', '/(tabs)'],
  [true, null, 'running', '/(tabs)'],
  [true, null, 'done', '/(tabs)'],
  [true, null, 'failed', '/(tabs)'],
  [true, null, 'cancelled', '/(tabs)'],
  [false, 'not_now', 'idle', '/(tabs)'],
  [false, 'not_now', 'running', '/(tabs)'],
  [false, 'not_now', 'done', '/(tabs)'],
  [false, 'not_now', 'failed', '/(tabs)'],
  [false, 'not_now', 'cancelled', '/(tabs)'],
  [false, null, 'idle', '/permission'],
  [false, null, 'running', '/importing'],
  [false, null, 'done', '/permission'],
  [false, null, 'failed', '/permission'],
  [false, null, 'cancelled', '/permission'],
];

describe('decideStartRoute', () => {
  it.each(TABLE)('done=%s choice=%s phase=%s -> %s', (done, choice, phase, route) => {
    expect(
      decideStartRoute({
        firstImportDone: done,
        onboardingChoice: choice,
        importPhase: phase,
        smsGranted: false,
      }),
    ).toBe(route);
  });

  const facts = (over: Partial<Parameters<typeof decideStartRoute>[0]>) =>
    decideStartRoute({
      firstImportDone: false,
      onboardingChoice: null,
      importPhase: 'idle',
      smsGranted: false,
      ...over,
    });

  it('resumes the scan behind Importing when SMS is granted but no import finished', () => {
    expect(facts({ smsGranted: true })).toBe('/importing');
    expect(facts({ smsGranted: true, importPhase: 'failed' })).toBe('/importing');
  });

  it('goes home when SMS is granted and the first scan is done', () => {
    expect(facts({ smsGranted: true, firstImportDone: true })).toBe('/(tabs)');
  });

  it('goes home after Not now even if SMS was granted later', () => {
    expect(facts({ smsGranted: true, onboardingChoice: 'not_now' })).toBe('/(tabs)');
  });
});
