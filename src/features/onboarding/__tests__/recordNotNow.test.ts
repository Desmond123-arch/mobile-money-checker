import { setup } from '@/data/__tests__/fixtures';
import { getMeta } from '@/data/meta';
import { loadStartRoute } from '@/features/app/loadStartRoute';

import { recordNotNow } from '../recordNotNow';

const sms = { getPermissionStatus: async () => 'undetermined' as const };

describe('recordNotNow', () => {
  it('persists the choice so the next launch opens Home', async () => {
    const db = await setup();
    expect(await loadStartRoute(db, sms)).toBe('/permission');
    await recordNotNow(db);
    expect(await getMeta(db, 'onboarding_choice')).toBe('not_now');
    expect(await loadStartRoute(db, sms)).toBe('/(tabs)');
  });

  it('is safe to repeat', async () => {
    const db = await setup();
    await recordNotNow(db);
    await recordNotNow(db);
    expect(await getMeta(db, 'onboarding_choice')).toBe('not_now');
  });
});
