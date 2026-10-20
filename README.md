# momo-spend

Android app that reads MTN MoMo confirmation SMS on the device and turns them into a categorised monthly spending history. Everything stays on the phone: no backend, no network calls. Expo dev build (a custom Kotlin module reads the SMS, so Expo Go cannot run it), expo-sqlite for storage.

Start with `docs/`: `spec.md` (what), `categorisation.md` (rules), `design.md` (screens), `system-design.md` (how it is built), `design-review.md` (what an adversarial review changed).

## Commands

| Command           | What it does                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install`     | Installs dependencies and the git hooks (`lefthook`)                                                                                                               |
| `npm run check`   | Typecheck, lint, format check and tests with coverage: the checks CI runs (CI also runs `expo-doctor`, an Android bundle build, and a commit-message check on PRs) |
| `npm test`        | Jest tests for the pure domain, run in plain Node                                                                                                                  |
| `npm run test:ci` | The same tests with a coverage gate on `src/domain`                                                                                                                |
| `npm run android` | Builds and runs the dev build on a connected Android device (`expo run:android`)                                                                                   |
| `npm start`       | Starts Metro for the dev client                                                                                                                                    |

## Conventions

- **Commits follow Conventional Commits**, enforced by `commitlint` on `commit-msg`: `type(scope): subject`, 72 characters or fewer. Types: `feat fix refactor perf test docs build ci chore revert`. Scopes: `sms parser ledger db categorise ui home transactions insights settings app docs deps tooling`.
- Styling is NativeWind (Tailwind) `className`s; design tokens live in `tailwind.config.js`.
- `src/domain` is pure TypeScript with no React Native, Expo or SQLite imports (an ESLint rule enforces it), and money is never parsed with floats.
- Raw SMS exports (`*.xml`) are git-ignored and must never be committed.
