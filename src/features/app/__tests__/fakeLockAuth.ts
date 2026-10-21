import type { AuthResult } from '../appLock';
import type { LockAuth } from '../lockAuth';

export interface FakeLockAuth extends LockAuth {
  available: boolean;
  /** Results handed out in order; the last one repeats. */
  results: AuthResult[];
  prompts: number;
}

export const fakeLockAuth = (
  results: AuthResult[] = ['success'],
  available = true,
): FakeLockAuth => {
  const fake: FakeLockAuth = {
    available,
    results,
    prompts: 0,
    isAvailable: async () => fake.available,
    authenticate: async () => {
      const result = fake.results[Math.min(fake.prompts, fake.results.length - 1)] ?? 'failed';
      fake.prompts += 1;
      return result;
    },
  };
  return fake;
};
