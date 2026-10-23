import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';

import { TRACKS } from '../../../assets/audio/tracks';
import { getMeta, setMeta } from '@/data/meta';
import { IDLE, reducePlayer, type PlayerStatus } from '@/domain/music/playlist';
import { useDb } from '@/features/app/DbProvider';

import { musicAdapter, type MusicAdapter } from './audio';
import { createMusicDriver } from './musicDriver';

const hasControls = (status: PlayerStatus) =>
  status === 'playing' || status === 'paused' || status === 'muted';

export interface WrappedMusic {
  /** False when the audio engine is missing or failed; the mute button is hidden then. */
  available: boolean;
  muted: boolean;
  toggleMute: () => void;
}

/**
 * Plays the Wrapped playlist while `enabled`: starts when it turns on, pauses in the background,
 * and stops and releases the player when it turns off or the screen unmounts.
 */
export function useWrappedMusic(
  enabled: boolean,
  adapter: MusicAdapter = musicAdapter,
): WrappedMusic {
  const db = useDb();
  const [state, dispatch] = useReducer(reducePlayer, IDLE);
  const driver = useRef<ReturnType<typeof createMusicDriver> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    driver.current = createMusicDriver({
      adapter,
      sources: TRACKS.map((t) => ({ asset: t.asset, startAtSeconds: t.startAtSeconds })),
      dispatch: (e) => {
        if (!cancelled) dispatch(e);
      },
      onStarted: (index) => void setMeta(db, 'wrapped_track', String(index)).catch(() => {}),
    });
    void (async () => {
      const [last, muted] = await Promise.all([
        getMeta(db, 'wrapped_track'),
        getMeta(db, 'wrapped_muted'),
      ]);
      if (cancelled) return;
      dispatch({
        type: 'open',
        lastStarted: last === null ? null : Number(last),
        count: TRACKS.length,
        muted: muted === '1',
        available: adapter.isAvailable(),
      });
    })();
    const sub = AppState.addEventListener('change', (next) =>
      dispatch({ type: next === 'active' ? 'foreground' : 'background' }),
    );
    return () => {
      cancelled = true;
      sub.remove();
      driver.current = null;
      adapter.stop();
      dispatch({ type: 'close' });
    };
  }, [enabled, adapter, db]);

  useEffect(() => {
    driver.current?.sync(state);
  }, [state]);

  const muted = state.status === 'muted';
  const canToggle = hasControls(state.status);
  const toggleMute = useCallback(() => {
    if (!canToggle) return;
    const next = !muted;
    dispatch({ type: next ? 'mute' : 'unmute' });
    void setMeta(db, 'wrapped_muted', next ? '1' : '0').catch(() => {});
  }, [canToggle, muted, db]);

  return {
    available: enabled && state.status !== 'unavailable' && adapter.isAvailable(),
    muted,
    toggleMute,
  };
}
