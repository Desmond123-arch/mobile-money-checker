import type { MusicAdapter, TrackHandlers } from './audio';

export interface FakeMusicAdapter extends MusicAdapter {
  /** Every call, in order, as `play:<asset>`, `pause`, `resume` or `stop`. */
  calls: string[];
  /** Simulates the engine reporting on the current track. */
  fire: (event: keyof TrackHandlers) => void;
}

/** A recording stand-in for the expo-audio adapter, for tests. */
export function createFakeAdapter(available = true): FakeMusicAdapter {
  const calls: string[] = [];
  let handlers: TrackHandlers | null = null;
  return {
    calls,
    isAvailable: () => available,
    play(asset, h) {
      handlers = h;
      calls.push(`play:${asset}`);
    },
    pause: () => void calls.push('pause'),
    resume: () => void calls.push('resume'),
    stop() {
      handlers = null;
      calls.push('stop');
    },
    fire: (event) => handlers?.[event](),
  };
}
