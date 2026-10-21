import {
  IDLE,
  nextIndex,
  reducePlayer,
  startIndex,
  type PlayerEvent,
  type PlayerState,
  type PlayerStatus,
} from '../music/playlist';

const at = (status: PlayerStatus, index = 2, count = 5): PlayerState => ({ status, index, count });

describe('nextIndex', () => {
  it.each([
    [0, 5, 1],
    [3, 5, 4],
    [4, 5, 0],
    [0, 1, 0],
    [0, 0, 0],
  ])('after %i of %i comes %i', (i, count, expected) => {
    expect(nextIndex(i, count)).toBe(expected);
  });
});

describe('startIndex', () => {
  it.each([
    [null, 5, 0],
    [0, 5, 1],
    [3, 5, 4],
    [4, 5, 0],
    [9, 5, 0],
    [-1, 5, 0],
    [1.5, 5, 0],
    [0, 0, 0],
  ])('last started %p of %i starts at %i', (last, count, expected) => {
    expect(startIndex(last, count)).toBe(expected);
  });
});

const open = (over: Partial<Extract<PlayerEvent, { type: 'open' }>> = {}): PlayerEvent => ({
  type: 'open',
  lastStarted: null,
  count: 5,
  muted: false,
  available: true,
  ...over,
});

describe('reducePlayer', () => {
  it.each<[string, PlayerState, PlayerEvent, PlayerState]>([
    ['open starts the first track', IDLE, open(), at('playing', 0)],
    ['open rotates to the next track', IDLE, open({ lastStarted: 4 }), at('playing', 0)],
    ['open rotates from the middle', IDLE, open({ lastStarted: 1 }), at('playing', 2)],
    ['open while muted stays silent', IDLE, open({ muted: true }), at('muted', 0)],
    [
      'open without the native module',
      IDLE,
      open({ available: false }),
      { status: 'unavailable', index: 0, count: 5 },
    ],
    [
      'open with no tracks',
      IDLE,
      open({ count: 0 }),
      { status: 'unavailable', index: 0, count: 0 },
    ],
    ['track end advances', at('playing', 1), { type: 'trackEnded' }, at('playing', 2)],
    ['track end wraps after the last', at('playing', 4), { type: 'trackEnded' }, at('playing', 0)],
    ['track end while paused is ignored', at('paused'), { type: 'trackEnded' }, at('paused')],
    ['mute while playing', at('playing'), { type: 'mute' }, at('muted')],
    ['mute while paused', at('paused'), { type: 'mute' }, at('muted')],
    ['mute while idle is ignored', at('idle'), { type: 'mute' }, at('idle')],
    ['unmute resumes', at('muted'), { type: 'unmute' }, at('playing')],
    ['unmute while playing is ignored', at('playing'), { type: 'unmute' }, at('playing')],
    ['background pauses', at('playing'), { type: 'background' }, at('paused')],
    ['background while muted stays muted', at('muted'), { type: 'background' }, at('muted')],
    ['foreground resumes', at('paused'), { type: 'foreground' }, at('playing')],
    ['foreground while muted stays muted', at('muted'), { type: 'foreground' }, at('muted')],
    ['foreground when idle stays idle', at('idle'), { type: 'foreground' }, at('idle')],
    ['interruption pauses', at('playing'), { type: 'interruption' }, at('paused')],
    ['interruption while muted is ignored', at('muted'), { type: 'interruption' }, at('muted')],
    ['close stops', at('playing'), { type: 'close' }, at('idle')],
    ['close while muted stops', at('muted'), { type: 'close' }, at('idle')],
    ['close keeps unavailable', at('unavailable'), { type: 'close' }, at('unavailable')],
    ['error disables playback', at('playing'), { type: 'error' }, at('unavailable')],
    ['error when idle is ignored', at('idle'), { type: 'error' }, at('idle')],
  ])('%s', (_name, state, event, expected) => {
    expect(reducePlayer(state, event)).toEqual(expected);
  });

  it('returns the same object when nothing changes', () => {
    const s = at('paused');
    expect(reducePlayer(s, { type: 'background' })).toBe(s);
  });

  it('plays through the playlist and wraps, as a user would hear it', () => {
    let s = reducePlayer(IDLE, open({ lastStarted: 3 }));
    const heard = [s.index];
    for (let i = 0; i < 5; i++) {
      s = reducePlayer(s, { type: 'trackEnded' });
      heard.push(s.index);
    }
    expect(heard).toEqual([4, 0, 1, 2, 3, 4]);
  });
});
