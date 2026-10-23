/**
 * The Wrapped playlist. Order here is playback order. The five files are the owner's mp3s. The
 * mp3s carry no title, artist or licence tags, so those fields are stand-ins until they are
 * filled in (see README.md). To change a track, drop the file next to this one and edit its entry.
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
  /** Where in the file playback begins, in seconds. 0 plays from the start; 10 skips a 10 s intro. */
  startAtSeconds: number;
}

export const TRACKS: readonly Track[] = [
  {
    id: 'track-1',
    title: 'Track 1',
    artist: 'Unknown artist',
    license: 'Unknown, confirm before release',
    sourceUrl: null,
    credit: null,
    asset: require('./track-1.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'track-2',
    title: 'Track 2',
    artist: 'Unknown artist',
    license: 'Unknown, confirm before release',
    sourceUrl: null,
    credit: null,
    asset: require('./track-2.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'track-3',
    title: 'Track 3',
    artist: 'Unknown artist',
    license: 'Unknown, confirm before release',
    sourceUrl: null,
    credit: null,
    asset: require('./track-3.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'track-4',
    title: 'Track 4',
    artist: 'Unknown artist',
    license: 'Unknown, confirm before release',
    sourceUrl: null,
    credit: null,
    asset: require('./track-4.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'track-5',
    title: 'Track 5',
    artist: 'Unknown artist',
    license: 'Unknown, confirm before release',
    sourceUrl: null,
    credit: null,
    asset: require('./track-5.mp3'),
    startAtSeconds: 0,
  },
];
