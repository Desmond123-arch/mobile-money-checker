import { startScanTriggers, type AppStateLike } from '../triggers';
import type { ScanOutcome } from '../types';
import { FakeMomoSms } from './fakeMomoSms';

const OK: ScanOutcome = { status: 'ok', read: 0, payments: 0, changed: false };
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function harness(outcome: ScanOutcome = OK) {
  const sms = new FakeMomoSms();
  const scan = jest.fn(async () => outcome);
  let emit: (state: string) => void = () => undefined;
  const removed = jest.fn();
  const appState: AppStateLike = {
    addEventListener: (_type, listener) => {
      emit = listener;
      return { remove: removed };
    },
  };
  const triggers = startScanTriggers({ scan, sms, appState });
  return { sms, scan, triggers, setState: (s: string) => emit(s), removed };
}

describe('scan triggers', () => {
  it('scans when the app becomes active, not when it goes to the background', async () => {
    const { scan, setState } = harness();
    setState('background');
    setState('inactive');
    expect(scan).not.toHaveBeenCalled();
    setState('active');
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('scans when the inbox observer fires, once a scan has seen access', async () => {
    const { sms, scan, triggers } = harness();
    await triggers.run();
    expect(sms.listeners.size).toBe(1);
    scan.mockClear();

    sms.emitChange();

    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('does not register the observer without access', async () => {
    const { sms, triggers } = harness({ status: 'no_permission', permission: 'denied' });
    await triggers.run();
    expect(sms.listeners.size).toBe(0);
  });

  it('registers the observer once and drops it in the background', async () => {
    const { sms, triggers, setState } = harness();
    await triggers.run();
    await triggers.run();
    expect(sms.listeners.size).toBe(1);

    setState('background');
    expect(sms.listeners.size).toBe(0);

    setState('active');
    await flush();
    expect(sms.listeners.size).toBe(1);
  });

  it('stop removes the app state subscription and the observer', async () => {
    const { sms, triggers, removed } = harness();
    await triggers.run();

    triggers.stop();

    expect(removed).toHaveBeenCalled();
    expect(sms.listeners.size).toBe(0);
    await triggers.run();
    expect(sms.listeners.size).toBe(0);
  });
});
