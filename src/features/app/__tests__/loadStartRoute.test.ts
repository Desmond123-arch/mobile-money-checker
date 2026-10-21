import { setup } from '@/data/__tests__/fixtures';
import { setMeta } from '@/data/meta';
import { finishImport } from '@/ledger/finishImport';

import type { SmsPermissionStatus } from '@/scan/types';

import { loadStartRoute } from '../loadStartRoute';

const sms = (status: SmsPermissionStatus | Error) => ({
  getPermissionStatus: () =>
    status instanceof Error ? Promise.reject(status) : Promise.resolve(status),
});

describe('loadStartRoute', () => {
  it('sends a fresh install to Permission', async () => {
    expect(await loadStartRoute(await setup(), sms('undetermined'))).toBe('/permission');
  });

  it('sends the user home after Not now', async () => {
    const db = await setup();
    await setMeta(db, 'onboarding_choice', 'not_now');
    expect(await loadStartRoute(db, sms('undetermined'))).toBe('/(tabs)');
  });

  it('sends the user home once an import has finished', async () => {
    const db = await setup();
    await finishImport(db);
    expect(await loadStartRoute(db, sms('undetermined'))).toBe('/(tabs)');
  });

  it('resumes the scan when SMS is granted and nothing has been imported', async () => {
    expect(await loadStartRoute(await setup(), sms('granted'))).toBe('/importing');
  });

  it('goes home when SMS is granted and the first scan finished', async () => {
    const db = await setup();
    await finishImport(db);
    expect(await loadStartRoute(db, sms('granted'))).toBe('/(tabs)');
  });

  it.each(['denied', 'blocked'] as const)('sends a %s permission to Permission', async (status) => {
    expect(await loadStartRoute(await setup(), sms(status))).toBe('/permission');
  });

  it('sends the user to Permission when the module is missing', async () => {
    expect(await loadStartRoute(await setup(), sms(new Error('no module')))).toBe('/permission');
  });
});
