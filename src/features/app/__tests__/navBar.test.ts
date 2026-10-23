import { createNavBarController, hideNavBarFromMeta, navBarMetaValue } from '../navBar';

const setup = () => {
  const calls: boolean[] = [];
  const saved: boolean[] = [];
  const controller = createNavBarController(
    { setHidden: (h) => void calls.push(h) },
    async (h) => void saved.push(h),
  );
  return { calls, saved, controller };
};

describe('hideNavBarFromMeta', () => {
  it('hides unless the user switched it off', () => {
    expect(hideNavBarFromMeta(null)).toBe(true);
    expect(hideNavBarFromMeta('1')).toBe(true);
    expect(hideNavBarFromMeta('0')).toBe(false);
    expect(hideNavBarFromMeta('')).toBe(true);
  });

  it('round-trips through the stored value', () => {
    expect(hideNavBarFromMeta(navBarMetaValue(true))).toBe(true);
    expect(hideNavBarFromMeta(navBarMetaValue(false))).toBe(false);
  });
});

describe('createNavBarController', () => {
  it('hides the bar when the user never chose', () => {
    const { calls, controller } = setup();
    expect(controller.load(null)).toBe(true);
    expect(calls).toEqual([true]);
  });

  it('shows the bar when the saved choice is off', () => {
    const { calls, controller } = setup();
    expect(controller.load('0')).toBe(false);
    expect(calls).toEqual([false]);
    expect(controller.hidden).toBe(false);
  });

  it('applies and saves a change at once', async () => {
    const { calls, saved, controller } = setup();
    controller.load('1');
    await controller.set(false);
    expect(calls).toEqual([true, false]);
    expect(saved).toEqual([false]);
    expect(controller.hidden).toBe(false);
  });

  it('puts the bar back the way the user chose after the system brings it back', () => {
    const { calls, controller } = setup();
    controller.load('1');
    controller.reapply();
    controller.reapply();
    expect(calls).toEqual([true, true, true]);
    void controller.set(false);
    controller.reapply();
    expect(calls.at(-1)).toBe(false);
  });

  it('hides before the saved choice has been read', () => {
    const { calls, controller } = setup();
    expect(controller.hidden).toBe(true);
    controller.reapply();
    expect(calls).toEqual([true]);
  });
});
