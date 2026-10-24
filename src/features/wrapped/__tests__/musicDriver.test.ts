import { IDLE, reducePlayer, type PlayerEvent, type PlayerState } from '@/domain/music/playlist';

import { createFakeAdapter } from '../audioFake';
import { createMusicDriver } from '../musicDriver';

const ASSETS = [10, 11, 12];
const SOURCES = ASSETS.map((asset) => ({ asset, startAtSeconds: 0 }));

function setup(lastStarted: number | null = null, muted = false) {
  const adapter = createFakeAdapter();
  const started: number[] = [];
  let state: PlayerState = IDLE;
  const driver = createMusicDriver({
    adapter,
    sources: SOURCES,
    dispatch: (e) => send(e),
    onStarted: (i) => started.push(i),
  });
  function send(e: PlayerEvent) {
    state = reducePlayer(state, e);
    driver.sync(state);
  }
  send({ type: 'open', lastStarted, count: ASSETS.length, muted, available: true });
  return { adapter, started, send, state: () => state };
}

describe('music driver', () => {
  it('starts the track after the last started one', () => {
    const t = setup(0);
    expect(t.adapter.calls).toEqual(['play:11']);
    expect(t.started).toEqual([1]);
  });

  it('advances at the end of a track and wraps after the last', () => {
    const t = setup(null);
    t.adapter.fire('onEnded');
    t.adapter.fire('onEnded');
    t.adapter.fire('onEnded');
    expect(t.adapter.calls).toEqual(['play:10', 'play:11', 'play:12', 'play:10']);
    expect(t.started).toEqual([0, 1, 2, 0]);
  });

  it('stays silent while muted and starts on unmute', () => {
    const t = setup(null, true);
    expect(t.adapter.calls).toEqual(['stop']);
    t.send({ type: 'unmute' });
    expect(t.adapter.calls).toEqual(['stop', 'play:10']);
  });

  it('pauses in the background and resumes on return', () => {
    const t = setup(null);
    t.send({ type: 'background' });
    t.send({ type: 'foreground' });
    expect(t.adapter.calls).toEqual(['play:10', 'pause', 'resume']);
    expect(t.started).toEqual([0]);
  });

  it('does not resume on return when muted in the meantime', () => {
    const t = setup(null);
    t.send({ type: 'background' });
    t.send({ type: 'mute' });
    t.send({ type: 'foreground' });
    expect(t.adapter.calls.at(-1)).toBe('stop');
  });

  it('pauses when another app takes audio focus', () => {
    const t = setup(null);
    t.adapter.fire('onInterrupted');
    expect(t.state().status).toBe('paused');
    expect(t.adapter.calls).toEqual(['play:10', 'pause']);
  });

  it('releases the player on close', () => {
    const t = setup(null);
    t.send({ type: 'close' });
    expect(t.adapter.calls).toEqual(['play:10', 'stop']);
  });

  it('gives up quietly when the engine reports an error', () => {
    const t = setup(null);
    t.adapter.fire('onError');
    expect(t.state().status).toBe('unavailable');
    expect(t.adapter.calls).toEqual(['play:10', 'stop']);
  });

  it('replays a one-track playlist when it ends', () => {
    const adapter = createFakeAdapter();
    let state: PlayerState = IDLE;
    const driver = createMusicDriver({
      adapter,
      sources: [{ asset: 7, startAtSeconds: 0 }],
      dispatch: (e) => {
        state = reducePlayer(state, e);
        driver.sync(state);
      },
      onStarted: () => {},
    });
    state = reducePlayer(state, {
      type: 'open',
      lastStarted: null,
      count: 1,
      muted: false,
      available: true,
    });
    driver.sync(state);
    adapter.fire('onEnded');
    expect(adapter.calls).toEqual(['play:7', 'play:7']);
  });

  it('starts a track part way in when its entry says so, and every time it comes round', () => {
    const adapter = createFakeAdapter();
    let state: PlayerState = IDLE;
    const driver = createMusicDriver({
      adapter,
      sources: [
        { asset: 20, startAtSeconds: 10 },
        { asset: 21, startAtSeconds: 0 },
      ],
      dispatch: (e) => {
        state = reducePlayer(state, e);
        driver.sync(state);
      },
      onStarted: () => {},
    });
    state = reducePlayer(state, {
      type: 'open',
      lastStarted: null,
      count: 2,
      muted: false,
      available: true,
    });
    driver.sync(state);
    adapter.fire('onEnded');
    adapter.fire('onEnded');
    expect(adapter.calls).toEqual(['play:20@10', 'play:21', 'play:20@10']);
  });
});
