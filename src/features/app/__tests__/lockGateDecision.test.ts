import { initLock, reduceLock, showsLockScreen, type LockEvent, type LockState } from '../appLock';
import type { LockAuth } from '../lockAuth';
import { fakeLockAuth } from './fakeLockAuth';

// Mirrors LockGate's loop: prompt when locked with a pending prompt, and on a button press.
async function unlock(state: LockState, auth: LockAuth): Promise<LockState> {
  const started = reduceLock(state, { type: 'authStarted' });
  return reduceLock(started, { type: 'authFinished', result: await auth.authenticate() });
}

const settle = async (state: LockState, auth: LockAuth) =>
  state.phase === 'locked' && state.promptPending ? unlock(state, auth) : state;

const send = (state: LockState, ...events: LockEvent[]) =>
  events.reduce((s, e) => reduceLock(s, e), state);

describe('LockGate decisions with a fake authenticator', () => {
  it('lock off: children render, nothing prompts', async () => {
    const auth = fakeLockAuth();
    const state = await settle(initLock(false), auth);
    expect(showsLockScreen(state)).toBe(false);
    expect(auth.prompts).toBe(0);
  });

  it('cold start with the lock on: lock screen, one automatic prompt, then children', async () => {
    const auth = fakeLockAuth(['success']);
    const state = await settle(initLock(true), auth);
    expect(auth.prompts).toBe(1);
    expect(showsLockScreen(state)).toBe(false);
  });

  it('cancel leaves the lock screen up, with no second automatic prompt, and Unlock retries', async () => {
    const auth = fakeLockAuth(['cancelled', 'success']);
    let state = await settle(initLock(true), auth);
    expect(showsLockScreen(state)).toBe(true);
    state = await settle(state, auth);
    expect(auth.prompts).toBe(1);
    state = await unlock(state, auth);
    expect(auth.prompts).toBe(2);
    expect(showsLockScreen(state)).toBe(false);
  });

  it('a long trip relocks and prompts once; a short trip does not', async () => {
    const auth = fakeLockAuth(['success']);
    let state = await settle(initLock(true), auth);
    state = send(state, { type: 'backgrounded', at: 0 }, { type: 'foregrounded', at: 5_000 });
    state = await settle(state, auth);
    expect(auth.prompts).toBe(1);
    state = send(state, { type: 'backgrounded', at: 10_000 }, { type: 'foregrounded', at: 70_000 });
    expect(showsLockScreen(state)).toBe(true);
    state = await settle(state, auth);
    expect(auth.prompts).toBe(2);
    expect(showsLockScreen(state)).toBe(false);
  });

  it('a phone with no credential keeps the lock screen up and shows the unavailable phase', async () => {
    const auth = fakeLockAuth(['unavailable'], false);
    const state = await settle(initLock(true), auth);
    expect(state.phase).toBe('unavailable');
    expect(showsLockScreen(state)).toBe(true);
  });
});
