import { LOCK_ROW_HINT, lockRowSubtitle, lockToggleDisabled } from '../lockRowSubtitle';

describe('lockRowSubtitle', () => {
  it('explains the missing screen lock and blocks switching on', () => {
    expect(lockRowSubtitle(false, false)).toBe('Set a screen lock in your phone’s settings first');
    expect(lockToggleDisabled(false, false)).toBe(true);
  });

  it('shows the hint while the check is pending or the phone has a screen lock', () => {
    for (const available of [null, true]) {
      expect(lockRowSubtitle(available, false)).toBe(LOCK_ROW_HINT);
      expect(lockToggleDisabled(available, false)).toBe(false);
    }
  });

  it('keeps an enabled lock switchable even when the screen lock is gone', () => {
    expect(lockRowSubtitle(false, true)).toBe(LOCK_ROW_HINT);
    expect(lockToggleDisabled(false, true)).toBe(false);
  });

  it('makes no encryption claim', () => {
    expect(LOCK_ROW_HINT.toLowerCase()).not.toContain('encrypt');
  });
});
