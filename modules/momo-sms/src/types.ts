export type SmsPermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

/** Ids are Android's `_id`, a number on both sides of the bridge. Compare them as integers. */
export interface InboxRef {
  androidId: number;
  /** Epoch milliseconds. */
  receivedAt: number;
}

export interface RawSmsRow {
  androidId: number;
  sender: string;
  /** null when `isOtp`: a one-time-code body is dropped in Kotlin and never reaches JS. */
  body: string | null;
  receivedAt: number;
  isOtp: boolean;
}

export interface MomoSmsApi {
  /** 'blocked' means the system will not show the dialog again. */
  getPermissionStatus(): Promise<SmsPermissionStatus>;
  requestPermission(): Promise<SmsPermissionStatus>;
  /** Every inbox message from the allowed sender (`MobileMoney`), without bodies. */
  listMomoMessageIds(): Promise<InboxRef[]>;
  /** Bodies for ids that are still in the inbox and from the allowed sender; others are omitted. */
  readMessagesByIds(androidIds: number[]): Promise<RawSmsRow[]>;
  /** Foreground only. The callback carries no data and fires once per burst of inbox changes. */
  addInboxChangedListener(onChange: () => void): { remove(): void };
}
