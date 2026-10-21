// Types only: this file must never pull the native module into a test or a non-Android bundle.
export type {
  InboxRef,
  MomoSmsApi as SmsSource,
  RawSmsRow,
  SmsPermissionStatus,
} from '../../modules/momo-sms/src/types';

export interface ScanProgress {
  read: number;
  total: number;
  payments: number;
}

export type ScanOutcome =
  | {
      status: 'ok';
      /** Messages read this run. */
      read: number;
      payments: number;
      /** True when the run added, replaced or retired any stored message. */
      changed: boolean;
    }
  | { status: 'no_permission'; permission: 'denied' | 'blocked' | 'undetermined' }
  /** Permission is granted but the inbox holds nothing from the allowed sender. */
  | { status: 'no_messages' }
  | { status: 'failed' };
