// Synthesizes the five PLACEHOLDER wrapped music loops into assets/audio/track-1..5.
// Node only. Writes .m4a when `ffmpeg` is on PATH, otherwise .wav.
// Usage: node scripts/make-placeholder-music.mjs
import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(fileURLToPath(new URL('..', import.meta.url)), 'assets', 'audio');
const RATE = 22050;

const PENTATONIC = [0, 2, 4, 7, 9];
const MIDI_A4 = 69;
const hz = (midi) => 440 * 2 ** ((midi - MIDI_A4) / 12);

// root: MIDI note of the key. bpm and bars set the length. progression: scale degrees (pentatonic
// steps from the root) of the bass note per bar. pattern: pentatonic steps above the bass per
// eighth note. tone: harmonic weights of the pluck.
const TRACKS = [
  {
    root: 60,
    bpm: 96,
    bars: 7,
    progression: [0, 3, 4, 2],
    pattern: [0, 2, 4, 2, 3, 2, 4, 2],
    tone: [1, 0.3, 0.1],
  },
  {
    root: 62,
    bpm: 84,
    bars: 6,
    progression: [0, 2, 3, 4],
    pattern: [0, 3, 1, 4, 2, 4, 1, 3],
    tone: [1, 0.5, 0.2],
  },
  {
    root: 65,
    bpm: 112,
    bars: 8,
    progression: [0, 4, 3, 2],
    pattern: [0, 1, 2, 4, 2, 1, 3, 1],
    tone: [1, 0.2, 0.05],
  },
  {
    root: 57,
    bpm: 72,
    bars: 5,
    progression: [0, 2, 4, 3],
    pattern: [0, 2, 3, 4, 3, 2, 1, 2],
    tone: [1, 0.4, 0.3],
  },
  {
    root: 67,
    bpm: 100,
    bars: 7,
    progression: [0, 3, 2, 4],
    pattern: [0, 4, 2, 3, 1, 3, 2, 4],
    tone: [1, 0.15, 0.08],
  },
];

const degreeToMidi = (root, step) =>
  root + 12 * Math.floor(step / 5) + PENTATONIC[((step % 5) + 5) % 5];

function render({ root, bpm, bars, progression, pattern, tone }) {
  const eighth = Math.round((RATE * 60) / bpm / 2);
  const total = eighth * 8 * bars;
  const buf = new Float64Array(total);

  const pluck = (startSample, midi, amp, lenEighths) => {
    const f = hz(midi);
    const len = Math.min(eighth * lenEighths, total * 2);
    for (let n = 0; n < len; n++) {
      const t = n / RATE;
      const attack = Math.min(1, n / (RATE * 0.012));
      const env = attack * Math.exp(-t * (lenEighths > 4 ? 1.4 : 3.2));
      let s = 0;
      for (let h = 0; h < tone.length; h++) s += tone[h] * Math.sin(2 * Math.PI * f * (h + 1) * t);
      // Wrap around the end so the tail rings into the start and the loop has no click.
      buf[(startSample + n) % total] += s * env * amp;
    }
  };

  for (let bar = 0; bar < bars; bar++) {
    const bass = degreeToMidi(root - 12, progression[bar % progression.length]);
    pluck(bar * 8 * eighth, bass, 0.22, 8);
    for (let i = 0; i < 8; i++) {
      const step = progression[bar % progression.length] + pattern[i];
      pluck((bar * 8 + i) * eighth, degreeToMidi(root, step), 0.16, 3);
    }
  }

  // Two feedback taps for a soft room, also wrapped.
  const wet = new Float64Array(total);
  for (const [delay, gain] of [
    [Math.round(RATE * 0.19), 0.25],
    [Math.round(RATE * 0.37), 0.14],
  ]) {
    for (let n = 0; n < total; n++) wet[(n + delay) % total] += buf[n] * gain;
  }
  let peak = 0;
  for (let n = 0; n < total; n++) {
    buf[n] += wet[n];
    peak = Math.max(peak, Math.abs(buf[n]));
  }

  const pcm = Buffer.alloc(total * 2);
  for (let n = 0; n < total; n++)
    pcm.writeInt16LE(Math.round((buf[n] / peak) * 0.6 * 32767), n * 2);
  return pcm;
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
mkdirSync(OUT, { recursive: true });

TRACKS.forEach((track, i) => {
  const base = join(OUT, `track-${i + 1}`);
  const pcm = render(track);
  const seconds = (pcm.length / 2 / RATE).toFixed(1);
  writeFileSync(`${base}.wav`, wav(pcm));
  if (hasFfmpeg) {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        `${base}.wav`,
        '-c:a',
        'aac',
        '-b:a',
        '48k',
        `${base}.m4a`,
      ],
      { stdio: 'inherit' },
    );
    rmSync(`${base}.wav`);
  }
  console.log(`track-${i + 1}.${hasFfmpeg ? 'm4a' : 'wav'}  ${seconds}s  ${track.bpm} bpm`);
});
