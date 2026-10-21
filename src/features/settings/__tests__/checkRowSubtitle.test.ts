import { CHECK_ROW_HINT, checkRowSubtitle } from '../checkRowSubtitle';

const ok = (read: number) => ({
  kind: 'done' as const,
  outcome: { status: 'ok' as const, read, payments: 0, changed: read > 0 },
});

describe('checkRowSubtitle', () => {
  it('shows the hint before a check when access is granted', () => {
    expect(checkRowSubtitle('granted', { kind: 'idle' })).toBe(CHECK_ROW_HINT);
  });

  it('says access is off when it is not granted', () => {
    for (const p of ['denied', 'blocked', 'undetermined'] as const) {
      expect(checkRowSubtitle(p, { kind: 'idle' })).toContain('SMS access is off');
    }
  });

  it('shows the hint in a build with no SMS module', () => {
    expect(checkRowSubtitle(null, { kind: 'idle' })).toBe(CHECK_ROW_HINT);
  });

  it('reports a check in progress and its results', () => {
    expect(checkRowSubtitle('granted', { kind: 'checking' })).toBe('Checking…');
    expect(checkRowSubtitle('granted', ok(0))).toBe('Nothing new');
    expect(checkRowSubtitle('granted', ok(1))).toBe('1 new message read');
    expect(checkRowSubtitle('granted', ok(3))).toBe('3 new messages read');
    expect(
      checkRowSubtitle('granted', { kind: 'done', outcome: { status: 'no_messages' } }),
    ).toContain('No MobileMoney');
    expect(checkRowSubtitle('granted', { kind: 'done', outcome: { status: 'failed' } })).toContain(
      'Could not check',
    );
    expect(
      checkRowSubtitle('granted', {
        kind: 'done',
        outcome: { status: 'no_permission', permission: 'denied' },
      }),
    ).toContain('SMS access is off');
  });
});
