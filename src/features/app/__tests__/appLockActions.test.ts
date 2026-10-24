import { setup } from '@/data/__tests__/fixtures';
import { getMeta, setMeta } from '@/data/meta';

import { changeLock, loadLockEnabled } from '../appLockActions';
import { fakeLockAuth } from './fakeLockAuth';

describe('app lock flag', () => {
  it('is off by default and round-trips through meta', async () => {
    const db = await setup();
    expect(await getMeta(db, 'app_lock_enabled')).toBeNull();
    expect(await loadLockEnabled(db)).toBe(false);
    await setMeta(db, 'app_lock_enabled', '1');
    expect(await loadLockEnabled(db)).toBe(true);
    await setMeta(db, 'app_lock_enabled', '0');
    expect(await loadLockEnabled(db)).toBe(false);
  });
});

describe('changeLock', () => {
  it('turns on only after a successful authentication', async () => {
    const db = await setup();
    const auth = fakeLockAuth(['success']);
    expect(await changeLock(db, auth, true)).toBe('enabled');
    expect(auth.prompts).toBe(1);
    expect(await loadLockEnabled(db)).toBe(true);
  });

  it.each(['cancelled', 'failed'] as const)('stays off when the prompt ends in %s', async (r) => {
    const db = await setup();
    expect(await changeLock(db, fakeLockAuth([r]), true)).toBe('cancelled');
    expect(await loadLockEnabled(db)).toBe(false);
  });

  it('cannot turn on without a screen lock, and never prompts', async () => {
    const db = await setup();
    const auth = fakeLockAuth(['success'], false);
    expect(await changeLock(db, auth, true)).toBe('unavailable');
    expect(auth.prompts).toBe(0);
    expect(await loadLockEnabled(db)).toBe(false);
  });

  it('does not turn on when the prompt reports no credential', async () => {
    const db = await setup();
    expect(await changeLock(db, fakeLockAuth(['unavailable']), true)).toBe('unavailable');
    expect(await loadLockEnabled(db)).toBe(false);
  });

  it('turns off after a successful authentication', async () => {
    const db = await setup();
    await setMeta(db, 'app_lock_enabled', '1');
    expect(await changeLock(db, fakeLockAuth(['success']), false)).toBe('disabled');
    expect(await loadLockEnabled(db)).toBe(false);
  });

  it('stays on when the user cancels turning it off', async () => {
    const db = await setup();
    await setMeta(db, 'app_lock_enabled', '1');
    expect(await changeLock(db, fakeLockAuth(['cancelled']), false)).toBe('cancelled');
    expect(await loadLockEnabled(db)).toBe(true);
  });

  it('turns off without a credential, so a phone that lost its screen lock is not stuck', async () => {
    const db = await setup();
    await setMeta(db, 'app_lock_enabled', '1');
    expect(await changeLock(db, fakeLockAuth(['unavailable'], false), false)).toBe('disabled');
    expect(await loadLockEnabled(db)).toBe(false);
  });
});
