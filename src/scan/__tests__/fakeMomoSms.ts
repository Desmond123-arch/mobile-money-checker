import type { InboxRef, RawSmsRow, SmsPermissionStatus, SmsSource } from '../types';

export interface FakeMessage {
  androidId: number;
  sender?: string;
  body: string;
  receivedAt: number;
}

/**
 * Behaves like the Kotlin module: it lists and reads only the allowed sender (case-insensitive),
 * and hands back an OTP as `{ body: null, isOtp: true }`. `leakOtherSenders` breaks the first
 * rule on purpose, to prove the scan does not trust the native side alone.
 */
export class FakeMomoSms implements SmsSource {
  inbox: FakeMessage[] = [];
  permission: SmsPermissionStatus = 'granted';
  /** What requestPermission() will answer. */
  requestResult: SmsPermissionStatus = 'granted';
  leakOtherSenders = false;
  listCalls = 0;
  readCalls: number[][] = [];
  /** Awaited at the start of listMomoMessageIds, so a test can hold a scan open. */
  holdList: Promise<void> | null = null;
  /** Throws on the nth (1-based) readMessagesByIds call. */
  failReadOn: number | null = null;
  listeners = new Set<() => void>();

  add(...messages: FakeMessage[]): this {
    this.inbox.push(...messages);
    return this;
  }

  remove(androidId: number): this {
    this.inbox = this.inbox.filter((m) => m.androidId !== androidId);
    return this;
  }

  emitChange(): void {
    this.listeners.forEach((l) => l());
  }

  private visible(): FakeMessage[] {
    return this.inbox.filter(
      (m) => this.leakOtherSenders || (m.sender ?? 'MobileMoney').toLowerCase() === 'mobilemoney',
    );
  }

  async getPermissionStatus(): Promise<SmsPermissionStatus> {
    return this.permission;
  }

  async requestPermission(): Promise<SmsPermissionStatus> {
    this.permission = this.requestResult;
    return this.permission;
  }

  async listMomoMessageIds(): Promise<InboxRef[]> {
    this.listCalls += 1;
    await this.holdList;
    return this.visible().map(({ androidId, receivedAt }) => ({ androidId, receivedAt }));
  }

  async readMessagesByIds(ids: number[]): Promise<RawSmsRow[]> {
    this.readCalls.push([...ids]);
    if (this.failReadOn === this.readCalls.length) throw new Error('read failed');
    const wanted = new Set(ids);
    return this.visible()
      .filter((m) => wanted.has(m.androidId))
      .map((m) => {
        const isOtp = m.body.startsWith('<#>');
        return {
          androidId: m.androidId,
          sender: m.sender ?? 'MobileMoney',
          body: isOtp ? null : m.body,
          receivedAt: m.receivedAt,
          isOtp,
        };
      });
  }

  addInboxChangedListener(onChange: () => void): { remove(): void } {
    this.listeners.add(onChange);
    return { remove: () => void this.listeners.delete(onChange) };
  }
}
