import type { AudioPlayer } from 'expo-audio';

/** What the Wrapped music needs from an audio engine. `expo-audio` is imported only in this file. */
export interface TrackHandlers {
  onEnded: () => void;
  /** Another app took audio focus, or the system paused playback. */
  onInterrupted: () => void;
  onError: () => void;
}

export interface MusicAdapter {
  /** False in Expo Go or a dev client built before `expo-audio`; nothing else may be called then. */
  isAvailable(): boolean;
  /** Replaces the current track: releases it, then plays `asset` from `startAtSeconds` with a fade-in. */
  play(asset: number, handlers: TrackHandlers, fadeMs: number, startAtSeconds: number): void;
  pause(): void;
  resume(): void;
  /** Stops and releases the player. Safe to call when nothing is loaded. */
  stop(): void;
}

type ExpoAudio = typeof import('expo-audio');

const FADE_STEPS = 16;
const RESUME_FADE_MS = 300;

// Resolved on first use, so a build without the native module (Expo Go, an old dev client) does
// not throw at startup. `null` once it failed, so a failure is not retried on every call.
let loaded: ExpoAudio | null | undefined;
const loadModule = (): ExpoAudio | null => {
  if (loaded !== undefined) return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-audio') as ExpoAudio;
  } catch {
    loaded = null;
  }
  return loaded;
};

let modeSet = false;

export function createExpoAdapter(): MusicAdapter {
  let player: AudioPlayer | null = null;
  let fade: ReturnType<typeof setInterval> | null = null;
  // Bumped on every play and stop, so events from a released player are ignored.
  let generation = 0;
  let wantPlaying = false;

  const cancelFade = () => {
    if (fade !== null) clearInterval(fade);
    fade = null;
  };

  const fadeIn = (target: AudioPlayer, ms: number) => {
    cancelFade();
    let step = 0;
    target.volume = 0;
    fade = setInterval(() => {
      step += 1;
      try {
        target.volume = Math.min(1, step / FADE_STEPS);
      } catch {
        cancelFade();
      }
      if (step >= FADE_STEPS) cancelFade();
    }, ms / FADE_STEPS);
  };

  const release = () => {
    cancelFade();
    generation += 1;
    wantPlaying = false;
    const old = player;
    player = null;
    try {
      old?.remove();
    } catch {
      // Already released by the system.
    }
  };

  return {
    isAvailable: () => loadModule() !== null,

    play(asset, handlers, fadeMs, startAtSeconds) {
      const audio = loadModule();
      if (!audio) return handlers.onError();
      release();
      const mine = generation;
      try {
        if (!modeSet) {
          modeSet = true;
          // Take focus so other apps pause, and honour the silent switch. No background playback.
          void audio
            .setAudioModeAsync({
              interruptionMode: 'doNotMix',
              playsInSilentMode: false,
              shouldPlayInBackground: false,
            })
            .catch(() => {});
        }
        const next = audio.createAudioPlayer(asset);
        player = next;
        wantPlaying = true;
        let started = false;
        // The seek is asked for before play and again on the first loaded status, because a seek
        // sent before the file has loaded may be dropped.
        let sought = startAtSeconds <= 0;
        const seek = () => void next.seekTo(startAtSeconds).catch(() => {});
        next.addListener('playbackStatusUpdate', (status) => {
          if (mine !== generation) return;
          if (!sought && status.isLoaded) {
            sought = true;
            if (status.currentTime < startAtSeconds - 0.5) seek();
          }
          if (status.didJustFinish) {
            wantPlaying = false;
            handlers.onEnded();
          } else if (status.playing) {
            started = true;
          } else if (started && wantPlaying && status.isLoaded) {
            started = false;
            handlers.onInterrupted();
          }
        });
        next.volume = 0;
        if (startAtSeconds > 0) seek();
        next.play();
        fadeIn(next, fadeMs);
      } catch {
        release();
        handlers.onError();
      }
    },

    pause() {
      cancelFade();
      wantPlaying = false;
      try {
        player?.pause();
      } catch {
        // The player is gone; the next play replaces it.
      }
    },

    resume() {
      if (!player) return;
      wantPlaying = true;
      try {
        player.play();
        fadeIn(player, RESUME_FADE_MS);
      } catch {
        release();
      }
    },

    stop: release,
  };
}

export const musicAdapter: MusicAdapter = createExpoAdapter();
