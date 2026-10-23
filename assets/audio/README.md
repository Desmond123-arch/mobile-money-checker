# Wrapped music

The Wrapped story plays these tracks in order and wraps from the last to the first. The list is `tracks.ts`. Everything here is bundled in the app, so playback works offline.

**The five tracks are CC0 (public domain dedication), about 7.5 MB together.** CC0 asks for no credit. Each page was checked on 23 Oct 2026; the links are in `tracks.ts`.

| Track                  | Artist              | Source                                                                                                       | Notes                                                                                                                                    |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Little Ducklin         | Maarten Schellekens | [Free Music Archive](https://freemusicarchive.org/music/maarten-schellekens/public-domain-1/little-ducklin/) | 2:19                                                                                                                                     |
| Medieval Theme         | Maarten Schellekens | [Free Music Archive](https://freemusicarchive.org/music/maarten-schellekens/public-domain-1/medieval-theme/) | 2:37. The page marks it as AI generated. CC0 is declared, but the copyright status of AI music is less settled than a human-made track's |
| 4 mei                  | Maarten Schellekens | [Free Music Archive](https://freemusicarchive.org/music/maarten-schellekens/public-domain-1/4-mei/)          | 1:06                                                                                                                                     |
| Children's March Theme | Cleyton Kauffman    | [OpenGameArt](https://opengameart.org/content/childrens-march-theme)                                         | 1:04. The page asks for no credit; the author shares a SoundCloud link                                                                   |
| Happy Clappy Loop      | OwlishMedia         | [OpenGameArt](https://opengameart.org/content/happy-clappy-loop)                                             | The original is a 17 second seamless loop; it is repeated three times here (52 s)                                                        |

**How the files were made.** Each was downloaded from its source page, converted to 128 kbps stereo mp3 at 44.1 kHz, levelled to the same loudness with ffmpeg's `loudnorm` (-16 LUFS) so no track jumps in volume, and stripped of embedded cover art. Happy Clappy Loop was looped three times with `-stream_loop 2`. The earlier synthesized placeholders and the owner's first set of mp3s are no longer used.

## Replace a track

1. Drop the file into this folder. `.m4a`, `.mp3` and `.wav` all bundle (Metro's default asset extensions). Keep it small: a 2 to 3 minute track at 96 kbps is about 2 MB.
2. Edit that track's entry in `tracks.ts`: point `asset: require('./your-file.mp3')` at it and fill in `title`, `artist`, `license`, `sourceUrl` and `credit`.
3. Delete the old placeholder file if nothing else uses it.
4. To start a track part way in, set its `startAtSeconds` (for example `10` to skip a 10 second intro). It applies every time the track plays, including when the playlist wraps. A value past the end of the file plays nothing useful, so keep it well inside the track.
5. Nothing else changes. The count, the rotation and the now-playing line follow the array. Adding or removing entries is fine; the stored position wraps safely.

Audio files are assets, so a new track needs a new build (not a native rebuild if `expo-audio` is already in your dev client).

## What to record per track

Record these in the `tracks.ts` entry and keep the licence page link in `sourceUrl`:

- Title and artist.
- Licence name and version (for example "CC BY 4.0", "CC0", "Pixabay Content Licence").
- Source URL of the page where you got it and where the licence is stated.
- Attribution text, exactly as the licence asks (`credit`). Nothing on screen shows it since the now-playing line was removed, so a CC BY track needs a credits screen before it ships.
- The date you checked the licence (add it as a comment above the entry).

## Credits

`credit` is shown under the track title on the Wrapped screen. Set it whenever the licence requires attribution (CC BY and similar need the creator's name, the title, the licence and a link or notice). Leave it `null` for CC0 or an own-work track.

## Licences

Popular commercial songs cannot be used. Shipping one needs a licence from the label and the publisher, which is not something a free app gets by default. Use music you own, commissioned music, CC0, or CC BY (with the credit shown), and check that the licence allows use inside an app that may later earn money.
