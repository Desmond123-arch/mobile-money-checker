/**
 * The Wrapped playlist. Order here is playback order. PLACEHOLDER: all five entries are loops
 * synthesized by `scripts/make-placeholder-music.mjs`, our own output with no licence to honour.
 * To use a real track, drop the file next to this one and edit that entry (see README.md).
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Licence name, for example "CC BY 4.0". */
  license: string;
  sourceUrl: string | null;
  /** The attribution line the licence demands, shown under the title. `null` when none is needed. */
  credit: string | null;
  /** A `require()` of the audio file, so Metro bundles it. */
  asset: number;
}

export const TRACKS: readonly Track[] = [
  {
    id: 'placeholder-1',
    title: 'PLACEHOLDER: Morning Market',
    artist: 'momo-spend synth',
    license: 'Own work (synthesized)',
    sourceUrl: null,
    credit: null,
    asset: require('./track-1.m4a'),
  },
  {
    id: 'placeholder-2',
    title: 'PLACEHOLDER: Slow Tide',
    artist: 'momo-spend synth',
    license: 'Own work (synthesized)',
    sourceUrl: null,
    credit: null,
    asset: require('./track-2.m4a'),
  },
  {
    id: 'placeholder-3',
    title: 'PLACEHOLDER: Kiosk Rush',
    artist: 'momo-spend synth',
    license: 'Own work (synthesized)',
    sourceUrl: null,
    credit: null,
    asset: require('./track-3.m4a'),
  },
  {
    id: 'placeholder-4',
    title: 'PLACEHOLDER: Late Light',
    artist: 'momo-spend synth',
    license: 'Own work (synthesized)',
    sourceUrl: null,
    credit: null,
    asset: require('./track-4.m4a'),
  },
  {
    id: 'placeholder-5',
    title: 'PLACEHOLDER: Pay Day',
    artist: 'momo-spend synth',
    license: 'Own work (synthesized)',
    sourceUrl: null,
    credit: null,
    asset: require('./track-5.m4a'),
  },
];
