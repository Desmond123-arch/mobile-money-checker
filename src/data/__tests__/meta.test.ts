import { getMeta, setMeta } from '../meta';
import { setup } from './fixtures';

describe('meta helpers', () => {
  it('returns null for a key never written', async () => {
    expect(await getMeta(await setup(), 'onboarding_choice')).toBeNull();
  });

  it('writes, then overwrites', async () => {
    const db = await setup();
    await setMeta(db, 'onboarding_choice', 'not_now');
    expect(await getMeta(db, 'onboarding_choice')).toBe('not_now');
    await setMeta(db, 'onboarding_choice', 'other');
    expect(await getMeta(db, 'onboarding_choice')).toBe('other');
  });
});
