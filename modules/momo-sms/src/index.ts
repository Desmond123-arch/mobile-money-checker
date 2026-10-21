import { NativeModule, requireNativeModule } from 'expo';

import type { InboxRef, MomoSmsApi, RawSmsRow, SmsPermissionStatus } from './types';

export type * from './types';

type Events = { onInboxChanged: () => void };

declare class NativeMomoSms extends NativeModule<Events> {
  getPermissionStatus(): Promise<SmsPermissionStatus>;
  requestPermission(): Promise<SmsPermissionStatus>;
  listMomoMessageIds(): Promise<InboxRef[]>;
  readMessagesByIds(androidIds: number[]): Promise<RawSmsRow[]>;
  startInboxObserver(): void;
  stopInboxObserver(): void;
}

// Resolved on first call, so importing this file in a build without the native module (Expo Go)
// does not throw at startup.
let loaded: NativeMomoSms | null = null;
const native = (): NativeMomoSms => (loaded ??= requireNativeModule<NativeMomoSms>('MomoSms'));

let listeners = 0;

export const momoSms: MomoSmsApi = {
  getPermissionStatus: () => native().getPermissionStatus(),
  requestPermission: () => native().requestPermission(),
  listMomoMessageIds: () => native().listMomoMessageIds(),
  readMessagesByIds: (ids) => native().readMessagesByIds(ids),
  addInboxChangedListener(onChange) {
    const subscription = native().addListener('onInboxChanged', onChange);
    if (listeners++ === 0) native().startInboxObserver();
    let removed = false;
    return {
      remove() {
        if (removed) return;
        removed = true;
        subscription.remove();
        if (--listeners === 0) native().stopInboxObserver();
      },
    };
  },
};
