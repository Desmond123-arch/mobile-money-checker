import type { PlayerEvent, PlayerState } from '@/domain/music/playlist';

import type { MusicAdapter } from './audio';

export const FADE_IN_MS = 800;

interface DriverOptions {
  adapter: MusicAdapter;
  /** What to play for each track, in playlist order. */
  sources: readonly { asset: number; startAtSeconds: number }[];
  dispatch: (event: PlayerEvent) => void;
  /** Called each time a track actually starts, with its index. */
  onStarted: (index: number) => void;
}

/** Mirrors the reducer's state onto the audio adapter. Calling `sync` twice with one state is harmless. */
export function createMusicDriver({ adapter, sources, dispatch, onStarted }: DriverOptions) {
  let loadedIndex: number | null = null;

  const handlers = {
    onEnded: () => {
      loadedIndex = null;
      dispatch({ type: 'trackEnded' });
    },
    onInterrupted: () => dispatch({ type: 'interruption' }),
    onError: () => dispatch({ type: 'error' }),
  };

  return {
    sync(state: PlayerState) {
      if (state.status === 'playing') {
        const source = sources[state.index];
        if (source === undefined) return dispatch({ type: 'error' });
        if (loadedIndex === state.index) return adapter.resume();
        loadedIndex = state.index;
        adapter.play(source.asset, handlers, FADE_IN_MS, source.startAtSeconds);
        onStarted(state.index);
      } else if (state.status === 'paused') {
        adapter.pause();
      } else {
        loadedIndex = null;
        adapter.stop();
      }
    },
  };
}
