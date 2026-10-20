export interface WriteQueue {
  /** Runs `task` after every earlier task has settled. A failure rejects only its own caller. */
  run<T>(task: () => Promise<T>): Promise<T>;
  /**
   * Single-flight: while a task is queued or running, further calls share its promise and set a
   * flag that makes the task run once more after it, so a request made mid-run is never lost.
   */
  runCoalesced(task: () => Promise<void>): Promise<void>;
}

export function createWriteQueue(): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve();

  const run = <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task);
    tail = next.catch(() => undefined);
    return next;
  };

  let inflight: Promise<void> | null = null;
  let rerun = false;

  const runCoalesced = (task: () => Promise<void>): Promise<void> => {
    if (inflight) {
      rerun = true;
      return inflight;
    }
    const loop = async () => {
      try {
        do {
          rerun = false;
          await run(task);
        } while (rerun);
      } finally {
        inflight = null;
      }
    };
    inflight = loop();
    return inflight;
  };

  return { run, runCoalesced };
}

/** The one queue every ledger write in the app goes through (system-design 7.7). */
export const ledgerQueue = createWriteQueue();
