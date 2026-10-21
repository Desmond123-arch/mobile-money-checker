import { setup } from '@/data/__tests__/fixtures';
import { setMeta } from '@/data/meta';
import { finishImport } from '@/ledger/finishImport';

import { loadStartRoute } from '../loadStartRoute';

describe('loadStartRoute', () => {
  it('sends a fresh install to Permission', async () => {
    expect(await loadStartRoute(await setup())).toBe('/permission');
  });

  it('sends the user home after Not now', async () => {
    const db = await setup();
    await setMeta(db, 'onboarding_choice', 'not_now');
    expect(await loadStartRoute(db)).toBe('/(tabs)');
  });

  it('sends the user home once an import has finished', async () => {
    const db = await setup();
    await finishImport(db);
    expect(await loadStartRoute(db)).toBe('/(tabs)');
  });
});
