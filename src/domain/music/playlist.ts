/**
 * Wrapped background music. A playlist is an ordered list of `count` tracks addressed by index.
 * The player is a reducer over events, so the rules (what pauses, what resumes, what wraps) are
 * table-testable and the React hook only has to mirror `state` onto the audio adapter.
 */

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'muted' | 'unavailable';

export interface PlayerState {
  status: PlayerStatus;
  /** The track that is playing, or would play next on resume. Always in `[0, count)` when count > 0. */
  index: number;
  count: number;
}

export type PlayerEvent =
  | { type: 'open'; lastStarted: number | null; count: number; muted: boolean; available: boolean }
  | { type: 'trackEnded' }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'background' }
  | { type: 'foreground' }
  | { type: 'close' }
  | { type: 'interruption' }
  | { type: 'error' };

export const IDLE: PlayerState = { status: 'idle', index: 0, count: 0 };

/** The track after `i`, wrapping from the last back to the first. */
export const nextIndex = (i: number, count: number): number =>
  count <= 0 ? 0 : (((i + 1) % count) + count) % count;

/** The track to start with: the one after the last one started, or the first when none is remembered or it is stale. */
export const startIndex = (lastStarted: number | null, count: number): number =>
  lastStarted === null || !Number.isInteger(lastStarted) || lastStarted < 0 || lastStarted >= count
    ? 0
    : nextIndex(lastStarted, count);

const to = (state: PlayerState, status: PlayerStatus): PlayerState =>
  state.status === status ? state : { ...state, status };

export function reducePlayer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'open':
      if (!event.available || event.count <= 0) {
        return { status: 'unavailable', index: 0, count: Math.max(event.count, 0) };
      }
      return {
        status: event.muted ? 'muted' : 'playing',
        index: startIndex(event.lastStarted, event.count),
        count: event.count,
      };
    case 'close':
      return state.status === 'unavailable' ? state : { ...state, status: 'idle' };
    case 'trackEnded':
      return state.status === 'playing'
        ? { ...state, index: nextIndex(state.index, state.count) }
        : state;
    case 'mute':
      return state.status === 'playing' || state.status === 'paused' ? to(state, 'muted') : state;
    case 'unmute':
      return state.status === 'muted' ? to(state, 'playing') : state;
    case 'background':
    case 'interruption':
      return state.status === 'playing' ? to(state, 'paused') : state;
    case 'foreground':
      return state.status === 'paused' ? to(state, 'playing') : state;
    case 'error':
      return state.status === 'idle' ? state : to(state, 'unavailable');
  }
}
