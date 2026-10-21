import {
  LOCK_GRACE_MS,
  initLock,
  reduceLock,
  showsLockScreen,
  type AuthResult,
  type LockEvent,
  type LockState,
} from '../appLock';

const run = (start: LockState, events: LockEvent[]) =>
  events.reduce((state, event) => reduceLock(state, event), start);

const T = 1_000_000;
const unlockedOn = (): LockState => run(initLock(true), [{ type: 'authStarted' }, done('success')]);
const done = (result: AuthResult): LockEvent => ({ type: 'authFinished', result });

describe('app lock state machine', () => {
  it('starts unlocked, with no prompt, when the lock is off', () => {
    const s = initLock(false);
    expect(s).toMatchObject({ phase: 'unlocked', promptPending: false });
    expect(showsLockScreen(s)).toBe(false);
  });

  it('starts locked and asks to prompt when the lock is on', () => {
    const s = initLock(true);
    expect(s).toMatchObject({ phase: 'locked', promptPending: true });
    expect(showsLockScreen(s)).toBe(true);
  });

  it('unlocks on success and keeps the grace bookkeeping empty', () => {
    expect(unlockedOn()).toMatchObject({ phase: 'unlocked', backgroundedAt: null });
  });

  it.each(['cancelled', 'failed'] as const)('stays locked after %s, without re-prompting', (r) => {
    const s = run(initLock(true), [{ type: 'authStarted' }, done(r)]);
    expect(s).toMatchObject({ phase: 'locked', promptPending: false });
    expect(showsLockScreen(s)).toBe(true);
  });

  it('retry from locked authenticates again and can succeed', () => {
    const s = run(initLock(true), [
      { type: 'authStarted' },
      done('cancelled'),
      { type: 'authStarted' },
      done('success'),
    ]);
    expect(s.phase).toBe('unlocked');
  });

  it('shows the unavailable phase when the phone has no credential, and a retry works', () => {
    const s = run(initLock(true), [{ type: 'authStarted' }, done('unavailable')]);
    expect(s.phase).toBe('unavailable');
    expect(showsLockScreen(s)).toBe(true);
    expect(run(s, [{ type: 'authStarted' }, done('success')]).phase).toBe('unlocked');
  });

  describe('grace period', () => {
    const away = (ms: number) =>
      run(unlockedOn(), [
        { type: 'backgrounded', at: T },
        { type: 'foregrounded', at: T + ms },
      ]);

    it('stays unlocked for a short trip such as a file picker', () => {
      expect(away(5_000).phase).toBe('unlocked');
    });

    it('stays unlocked at exactly the grace period', () => {
      expect(away(LOCK_GRACE_MS).phase).toBe('unlocked');
    });

    it('locks one millisecond past the grace period and prompts', () => {
      expect(away(LOCK_GRACE_MS + 1)).toMatchObject({ phase: 'locked', promptPending: true });
    });

    it('locks after a long trip', () => {
      expect(away(60_000).phase).toBe('locked');
    });

    it('locks when the clock moved back', () => {
      expect(away(-5_000).phase).toBe('locked');
    });

    it('forgets the trip once back, so a later foreground event does not lock', () => {
      const s = run(away(5_000), [{ type: 'foregrounded', at: T + 10 * LOCK_GRACE_MS }]);
      expect(s.phase).toBe('unlocked');
    });

    it('honours a custom grace period', () => {
      const s = unlockedOn();
      const back = [
        { type: 'backgrounded', at: T },
        { type: 'foregrounded', at: T + 2_000 },
      ] as const;
      const result = back.reduce((st, e) => reduceLock(st, e, 1_000), s);
      expect(result.phase).toBe('locked');
    });

    it('ignores foreground events with no recorded trip', () => {
      expect(run(unlockedOn(), [{ type: 'foregrounded', at: T }]).phase).toBe('unlocked');
    });

    it('does not track trips while the lock is off', () => {
      const s = run(initLock(false), [{ type: 'backgrounded', at: T }]);
      expect(s.backgroundedAt).toBeNull();
      expect(run(s, [{ type: 'foregrounded', at: T + 10 * LOCK_GRACE_MS }]).phase).toBe('unlocked');
    });

    it('ignores background trips while the system prompt is up', () => {
      const s = run(initLock(true), [
        { type: 'authStarted' },
        { type: 'backgrounded', at: T },
        { type: 'foregrounded', at: T + 10 * LOCK_GRACE_MS },
      ]);
      expect(s.phase).toBe('authenticating');
    });

    it('stays locked, without a new prompt, across a trip while locked after a cancel', () => {
      const s = run(initLock(true), [
        { type: 'authStarted' },
        done('cancelled'),
        { type: 'backgrounded', at: T },
        { type: 'foregrounded', at: T + 10 * LOCK_GRACE_MS },
      ]);
      expect(s).toMatchObject({ phase: 'locked', promptPending: false });
    });
  });

  describe('toggling in Settings', () => {
    it('turning it on keeps the user in the app', () => {
      const s = run(initLock(false), [{ type: 'enabledChanged', enabled: true }]);
      expect(s).toMatchObject({ enabled: true, phase: 'unlocked' });
      expect(showsLockScreen(s)).toBe(false);
    });

    it('turning it on then leaving for longer than the grace period locks', () => {
      const s = run(initLock(false), [
        { type: 'enabledChanged', enabled: true },
        { type: 'backgrounded', at: T },
        { type: 'foregrounded', at: T + LOCK_GRACE_MS + 1 },
      ]);
      expect(s.phase).toBe('locked');
    });

    it('turning it off never shows the lock screen again', () => {
      const s = run(unlockedOn(), [
        { type: 'enabledChanged', enabled: false },
        { type: 'backgrounded', at: T },
        { type: 'foregrounded', at: T + 10 * LOCK_GRACE_MS },
      ]);
      expect(s.phase).toBe('unlocked');
      expect(showsLockScreen(s)).toBe(false);
    });
  });

  it('ignores auth results nobody asked for', () => {
    const s = unlockedOn();
    expect(reduceLock(s, done('failed'))).toBe(s);
    expect(reduceLock(s, { type: 'authStarted' })).toBe(s);
  });
});
