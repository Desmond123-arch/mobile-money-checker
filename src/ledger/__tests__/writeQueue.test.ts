import { createWriteQueue } from '../writeQueue';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('write queue', () => {
  it('runs tasks one at a time in call order', async () => {
    const q = createWriteQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`start ${name}`);
      await tick();
      log.push(`end ${name}`);
      return name;
    };
    const out = await Promise.all([q.run(task('a')), q.run(task('b')), q.run(task('c'))]);
    expect(out).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('a failing task rejects its caller and does not block later tasks', async () => {
    const q = createWriteQueue();
    const failing = q.run(async () => {
      throw new Error('boom');
    });
    const after = q.run(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(after).resolves.toBe('ok');
  });

  it('coalesces requests made while a task runs into one rerun', async () => {
    const q = createWriteQueue();
    let runs = 0;
    const task = async () => {
      runs += 1;
      await tick();
    };
    const first = q.runCoalesced(task);
    const second = q.runCoalesced(task);
    const third = q.runCoalesced(task);
    await Promise.all([first, second, third]);
    expect(runs).toBe(2);
    await q.runCoalesced(task);
    expect(runs).toBe(3);
  });
});
