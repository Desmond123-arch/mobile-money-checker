import type { ScanOutcome, SmsPermissionStatus } from '@/scan/types';

export type CheckState =
  { kind: 'idle' } | { kind: 'checking' } | { kind: 'done'; outcome: ScanOutcome };

export const CHECK_ROW_HINT = 'Look for payments we have not read yet';

/** `permission` is null when this build has no SMS module. */
export function checkRowSubtitle(
  permission: SmsPermissionStatus | null,
  state: CheckState,
): string {
  if (state.kind === 'checking') return 'Checking…';
  if (state.kind === 'done') {
    const { outcome } = state;
    if (outcome.status === 'ok') {
      if (outcome.read === 0) return 'Nothing new';
      return `${outcome.read} new ${outcome.read === 1 ? 'message' : 'messages'} read`;
    }
    if (outcome.status === 'no_messages') return 'No MobileMoney messages found on this phone';
    if (outcome.status === 'failed') return 'Could not check. Try again';
    return 'SMS access is off. Tap to turn it on';
  }
  if (permission !== null && permission !== 'granted')
    return 'SMS access is off. Tap to turn it on';
  return CHECK_ROW_HINT;
}
