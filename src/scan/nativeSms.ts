import { momoSms } from '../../modules/momo-sms';

import type { SmsSource } from './types';

// The one place the native module is imported. `momoSms` loads the native side on first use, so a
// build without the module (Expo Go) fails inside a scan, where it is caught, not at startup.
export const nativeSms: SmsSource = momoSms;
