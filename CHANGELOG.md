# Changelog

Notable changes to momo-spend. For why and how the data layer should replace the stand-ins listed here, read [`docs/handoff.md`](docs/handoff.md). Commit history has the detail; this file is the map.

The app is a local-first proof of concept: every screen runs on sample data until the SMS module and SQLite layer from `docs/system-design.md` are connected.

## Unreleased

Everything below is in PR #7 (into `dev`) unless noted.

### Added

- **SQLite layer (`src/data`, not wired into any screen yet).** `Db` interface and `openDatabase` over `expo-sqlite` (WAL, foreign keys on, exclusive transactions), a `PRAGMA user_version` migrator, and migration `0001_init`, chosen from three candidate schemas (see the arena record in `docs/data-model.md`). Every table is STRICT. Observed (`sms_messages`, `sms_fragments`), derived (SMS `transactions`) and user-owned (`transaction_annotations`, `message_dismissals`, config, manual transactions) data live in separate tables. The categoriser writes `transactions.auto_category_id`; the user's tag lives only in `transaction_annotations`. The `ledger_lines` view is the single accounting rule: refunds net into the original's month and category, capped at the original amount. Triggers protect the five system categories and SMS rows even when foreign keys are off. `seedDatabase` adds the UI categories once per seed version. Deliberate changes to `system-design.md` section 6 are listed in `docs/data-model.md`, which supersedes it. Tests run on Node's `node:sqlite`.
- **Insights calendar.** The period pill opens a sheet with a Day and a Month switch. A day replaces "Where it went" with that date's spending, an empty state for days without payments, and a "not happened yet" state with an average day of that name. Pure helpers in `src/domain/calendar/week.ts`.
- **Add an expense.** A "+" on Home and Transactions opens a sheet (amount, what for, category, Today or Yesterday). Expenses are tagged "Added by you" and count towards Home's totals, categories and recent list. State lives in `ExpensesProvider`.
- **Month picker.** The month pill on Home opens a sheet; the choice drives Home and Insights (`PeriodProvider`).
- **Filters and search.** Category filter sheet (from Home's filter button and the Category pill), a search field on Transactions, and a Clear button.
- **Messages we couldn't read.** Ignore, Copy text, Add by hand, empty state.
- **Privacy screen**, hidden categories expanding in Settings, inline add-name chips, delete-category confirmation.
- **Home totals row:** Money in, Payments and A day (average spend per day so far), three equal centered columns. `dailyAverage` in `src/domain/summary/month.ts`.
- `allocate` (splits a total by weights so the parts sum exactly) in `src/domain/category/share.ts`.
- Maestro flows for each interaction (`maestro/flows`), project verification skill (`.claude/skills/verify-momo-spend`).
- **Backup import specified** (spec 5.1a, FR-19; design 3.1; system design 7.9). Not built.

### Changed

- Text line heights raised to at least 1.3x the font size, fixing clipped y, g and p on Android.
- Screens and sheets use `KeyboardAvoidingView`, so inputs sit above the keyboard.
- Copy text loads `expo-clipboard` lazily, so a dev build without the module does not crash Settings.

### Removed

- Fees and tax from the UI (Home totals, transaction detail). The domain still models fee and tax for the parser.
- The weekday bar chart on Insights (replaced by the calendar).

## 0.1.0: screens, tooling and builds (PRs #4 to #6)

### Added

- The 14 Paper screens in React Native with NativeWind, organised by feature context (`home`, `transactions`, `insights`, `categories`, `settings`, `onboarding`, later `period`, `expenses`). Pure types in `src/domain`, primitives in `src/ui`, thin routes in `src/app`.
- A camelCase `testID` on every interactive element (convention in `maestro/README.md`).
- Android-only EAS setup: `eas.json` (development, preview and production profiles, all APK), build scripts in `package.json`, and EAS workflows (push to `dev` builds development, push to `main` builds production).
- CodeRabbit config (`.coderabbit.yaml`), CI checks (typecheck, lint, format, tests with a 95% domain coverage gate, Expo doctor, bundle, Conventional Commits).

## Earlier

- Scaffold, integer-pesewas money parsing and formatting, design docs (`docs/`).
