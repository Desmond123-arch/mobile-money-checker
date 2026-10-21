import type { PlayerEvent, PlayerState } from '@/domain/music/playlist';

import type { MusicAdapter } from './audio';

export const FADE_IN_MS = 800;

interface DriverOptions {
  adapter: MusicAdapter;
  /** The `asset` of each track, in playlist order. */
  assets: readonly number[];
  dispatch: (event: PlayerEvent) => void;
  /** Called each time a track actually starts, with its index. */
  onStarted: (index: number) => void;
}

/** Mirrors the reducer's state onto the audio adapter. Calling `sync` twice with one state is harmless. */
export function createMusicDriver({ adapter, assets, dispatch, onStarted }: DriverOptions) {
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
        const asset = assets[state.index];
        if (asset === undefined) return dispatch({ type: 'error' });
        if (loadedIndex === state.index) return adapter.resume();
        loadedIndex = state.index;
        adapter.play(asset, handlers, FADE_IN_MS);
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
