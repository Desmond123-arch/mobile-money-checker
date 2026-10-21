# Wrapped music

The Wrapped story plays these tracks in order and wraps from the last to the first. The list is `tracks.ts`. Everything here is bundled in the app, so playback works offline.

**The five tracks are PLACEHOLDERS.** `scripts/make-placeholder-music.mjs` synthesizes them (short pentatonic loops, mono, 22.05 kHz, about 17 s each). They are our own output, so there is no licence to honour. Run `node scripts/make-placeholder-music.mjs` to regenerate them. It writes `.m4a` when `ffmpeg` is on PATH and `.wav` otherwise; if you get `.wav`, change the `require` extensions in `tracks.ts`.

## Replace a placeholder with a real track

1. Drop the file into this folder. `.m4a`, `.mp3` and `.wav` all bundle (Metro's default asset extensions). Keep it small: a 2 to 3 minute track at 96 kbps is about 2 MB.
2. Edit that track's entry in `tracks.ts`: point `asset: require('./your-file.mp3')` at it and fill in `title`, `artist`, `license`, `sourceUrl` and `credit`.
3. Delete the old placeholder file if nothing else uses it.
4. Nothing else changes. The count, the rotation and the now-playing line follow the array. Adding or removing entries is fine; the stored position wraps safely.

Audio files are assets, so a new track needs a new build (not a native rebuild if `expo-audio` is already in your dev client).

## What to record per track

Record these in the `tracks.ts` entry and keep the licence page link in `sourceUrl`:

- Title and artist.
- Licence name and version (for example "CC BY 4.0", "CC0", "Pixabay Content Licence").
- Source URL of the page where you got it and where the licence is stated.
- Attribution text, exactly as the licence asks (`credit`).
- The date you checked the licence (add it as a comment above the entry).

## Credits

`credit` is shown under the track title on the Wrapped screen. Set it whenever the licence requires attribution (CC BY and similar need the creator's name, the title, the licence and a link or notice). Leave it `null` for CC0 or an own-work track.

## Licences

Popular commercial songs cannot be used. Shipping one needs a licence from the label and the publisher, which is not something a free app gets by default. Use music you own, commissioned music, CC0, or CC BY (with the credit shown), and check that the licence allows use inside an app that may later earn money.
