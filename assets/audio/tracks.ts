/**
 * The Wrapped playlist. Order here is playback order. All five tracks are CC0 (public domain
 * dedication), checked on each source page on 23 Oct 2026. CC0 asks for no credit, so `credit` is
 * null. To change a track, drop the file next to this one and edit its entry (see README.md).
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Licence name, for example "CC BY 4.0". */
  license: string;
  sourceUrl: string | null;
  /** The attribution line a licence demands. `null` when none is needed. Nothing displays it today, so a track that needs one wants a credits screen first. */
  credit: string | null;
  /** A `require()` of the audio file, so Metro bundles it. */
  asset: number;
  /** Where in the file playback begins, in seconds. 0 plays from the start; 10 skips a 10 s intro. */
  startAtSeconds: number;
}

export const TRACKS: readonly Track[] = [
  {
    id: 'little-ducklin',
    title: 'Little Ducklin',
    artist: 'Maarten Schellekens',
    license: 'CC0 1.0 Universal',
    sourceUrl:
      'https://freemusicarchive.org/music/maarten-schellekens/public-domain-1/little-ducklin/',
    credit: null,
    asset: require('./little-ducklin.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'medieval-theme',
    title: 'Medieval Theme',
    artist: 'Maarten Schellekens',
    license: 'CC0 1.0 Universal',
    sourceUrl:
      'https://freemusicarchive.org/music/maarten-schellekens/public-domain-1/medieval-theme/',
    credit: null,
    asset: require('./medieval-theme.mp3'),
    startAtSeconds: 0,
  },
  {
    id: '4-mei',
    title: '4 mei',
    artist: 'Maarten Schellekens',
    license: 'CC0 1.0 Universal',
    sourceUrl: 'https://freemusicarchive.org/music/maarten-schellekens/public-domain-1/4-mei/',
    credit: null,
    asset: require('./4-mei.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'childrens-march-theme',
    title: "Children's March Theme",
    artist: 'Cleyton Kauffman',
    license: 'CC0 1.0 Universal',
    sourceUrl: 'https://opengameart.org/content/childrens-march-theme',
    credit: null,
    asset: require('./childrens-march-theme.mp3'),
    startAtSeconds: 0,
  },
  {
    id: 'happy-clappy-loop',
    title: 'Happy Clappy Loop',
    artist: 'OwlishMedia',
    license: 'CC0 1.0 Universal',
    sourceUrl: 'https://opengameart.org/content/happy-clappy-loop',
    credit: null,
    asset: require('./happy-clappy-loop.mp3'),
    startAtSeconds: 0,
  },
];
