import type { MusicAdapter } from '../audio';

type Listener = (status: Record<string, unknown>) => void;

class FakePlayer {
  static all: FakePlayer[] = [];
  static log: string[] = [];
  id: number;
  volume = 1;
  listener: Listener | null = null;
  constructor(public asset: number) {
    this.id = FakePlayer.all.length;
    FakePlayer.all.push(this);
    FakePlayer.log.push(`create:${asset}`);
  }
  play = () => void FakePlayer.log.push(`play:${this.asset}`);
  pause = () => void FakePlayer.log.push(`pause:${this.asset}`);
  remove = () => void FakePlayer.log.push(`remove:${this.asset}`);
  release = () => void FakePlayer.log.push(`release:${this.asset}`);
  seekTo = (s: number) => {
    FakePlayer.log.push(`seek:${this.asset}@${s}`);
    return Promise.resolve();
  };
  addListener = (_: string, cb: Listener) => {
    this.listener = cb;
  };
}

let finishMode: () => void;
let modeCalls = 0;

function load(): MusicAdapter {
  FakePlayer.all = [];
  FakePlayer.log = [];
  modeCalls = 0;
  let adapter!: MusicAdapter;
  jest.isolateModules(() => {
    jest.doMock('expo-audio', () => ({
      createAudioPlayer: (asset: number) => new FakePlayer(asset),
      setAudioModeAsync: () => {
        modeCalls += 1;
        FakePlayer.log.push('mode');
        return new Promise<void>((resolve) => {
          finishMode = resolve;
        });
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    adapter = (require('../audio') as typeof import('../audio')).createExpoAdapter();
    // The adapter loads expo-audio on first use; do that here, inside this isolated registry.
    adapter.isAvailable();
  });
  return adapter;
}

const handlers = { onEnded: jest.fn(), onInterrupted: jest.fn(), onError: jest.fn() };
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('expo audio adapter', () => {
  it('sets the audio mode before the first player exists', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    await flush();
    expect(FakePlayer.log).toEqual(['mode']);
    finishMode();
    await flush();
    expect(FakePlayer.log).toEqual(['mode', 'create:1', 'play:1']);
  });

  it('sets the audio mode once, however many tracks play', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    finishMode();
    await flush();
    adapter.play(2, handlers, 0, 0);
    await flush();
    expect(modeCalls).toBe(1);
    expect(FakePlayer.all).toHaveLength(2);
  });

  it('stops, forgets and releases the old player before the next one is created', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    finishMode();
    await flush();
    adapter.play(2, handlers, 0, 0);
    await flush();
    expect(FakePlayer.log.slice(FakePlayer.log.indexOf('play:1') + 1)).toEqual([
      'pause:1',
      'remove:1',
      'release:1',
      'create:2',
      'play:2',
    ]);
  });

  it('stops and releases the track when told to stop, even if it is playing', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    finishMode();
    await flush();
    adapter.stop();
    expect(FakePlayer.log.slice(-3)).toEqual(['pause:1', 'remove:1', 'release:1']);
    adapter.stop();
    expect(FakePlayer.log.filter((l) => l === 'release:1')).toHaveLength(1);
  });

  it('never creates a player for a track that was replaced while the mode loaded', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    adapter.play(2, handlers, 0, 0);
    finishMode();
    await flush();
    expect(FakePlayer.all.map((p) => p.asset)).toEqual([2]);
  });

  it('never creates a player once stopped while the mode loaded', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    adapter.stop();
    finishMode();
    await flush();
    expect(FakePlayer.all).toHaveLength(0);
  });

  it('starts a track that was paused while the mode loaded when it resumes', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    adapter.pause();
    finishMode();
    await flush();
    expect(FakePlayer.all).toHaveLength(0);
    adapter.resume();
    expect(FakePlayer.log).toEqual(['mode', 'create:1', 'play:1']);
  });

  it('seeks before play when a track starts part way in', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 10);
    finishMode();
    await flush();
    expect(FakePlayer.log).toEqual(['mode', 'create:1', 'seek:1@10', 'play:1']);
  });

  it('seeks again on the first loaded status if the player is still at the start', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 10);
    finishMode();
    await flush();
    FakePlayer.all[0]?.listener?.({ isLoaded: true, currentTime: 0 });
    expect(FakePlayer.log.filter((l) => l.startsWith('seek'))).toHaveLength(2);
    FakePlayer.all[0]?.listener?.({ isLoaded: true, currentTime: 0 });
    expect(FakePlayer.log.filter((l) => l.startsWith('seek'))).toHaveLength(2);
  });

  it('reports the end of the current track, and nothing from one that was replaced', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    finishMode();
    await flush();
    const first = FakePlayer.all[0];
    adapter.play(2, handlers, 0, 0);
    await flush();
    first?.listener?.({ isLoaded: true, didJustFinish: true });
    expect(handlers.onEnded).not.toHaveBeenCalled();
    FakePlayer.all[1]?.listener?.({ isLoaded: true, didJustFinish: true });
    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
  });

  it('reports an interruption only after playback had started', async () => {
    const adapter = load();
    adapter.play(1, handlers, 0, 0);
    finishMode();
    await flush();
    const listener = FakePlayer.all[0]?.listener;
    listener?.({ isLoaded: true, playing: false });
    expect(handlers.onInterrupted).not.toHaveBeenCalled();
    listener?.({ isLoaded: true, playing: true });
    listener?.({ isLoaded: true, playing: false });
    expect(handlers.onInterrupted).toHaveBeenCalledTimes(1);
  });

  it('reports an error when the module cannot create a player', async () => {
    FakePlayer.all = [];
    let adapter!: MusicAdapter;
    jest.isolateModules(() => {
      jest.doMock('expo-audio', () => ({
        createAudioPlayer: () => {
          throw new Error('no codec');
        },
        setAudioModeAsync: () => Promise.resolve(),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      adapter = (require('../audio') as typeof import('../audio')).createExpoAdapter();
      // The adapter loads expo-audio on first use; do that here, inside this isolated registry.
      adapter.isAvailable();
    });
    adapter.play(1, handlers, 0, 0);
    await flush();
    expect(handlers.onError).toHaveBeenCalledTimes(1);
  });
});
