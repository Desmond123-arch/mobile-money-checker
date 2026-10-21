# Changelog

Notable changes to momo-spend. For why and how the data layer should replace the stand-ins listed here, read [`docs/handoff.md`](docs/handoff.md). Commit history has the detail; this file is the map.

The app is a local-first proof of concept: every screen runs on sample data until the SMS module and SQLite layer from `docs/system-design.md` are connected.

## Unreleased

Everything below is in PR #7 (into `dev`) unless noted.

### Added

- **SMS parser (`src/domain/parse`, not wired into the app yet).** `parseSms` for all 11 MoMo message shapes plus OTP, no-transaction-id and failed-payment classification; `mergeAll` (commutative per-field merge of a transaction's messages); `linkReversals`; `reconcileBalances`; `parseBodyTime` in `src/domain/time.ts`. On the sample export (2,488 messages) 1,913 of 1,919 transaction-labelled messages parse; the other 6 are failed payments and are ignored. Dev tools: `npm run check:sms -- <export.xml>` (real-data check) and `npm run anonymise:sms -- <export.xml>` (writes `fixtures/sms`). Branch `feat/sms-parser`, into `dev`.
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
- **Backup import, everything except the parser and ledger** (spec 5.1a, FR-19; design 3.1; system design 7.9).
  - `sms_messages` gets `source` (`inbox` or `backup`), a nullable `android_sms_id` and a `backup_key` identity (`<received_at>:<momo_txn_id>:<template_name>`). Edited into `0001_init` because it is unreleased. `source_on_phone` and `unread_messages` count inbox rows only.
  - `src/backup`: a streaming reader for SMS Backup & Restore XML (`readBackupMessages`, `countBackupMessages`) that runs on any byte source, Expo adapters (`pickBackupFile`, `openExpoFile`), the `importBackup` orchestrator with an injected `ingestBatch`, and a progress store.
  - Permission screen has "Import a backup file", which opens the steps sheet (`/sheets/import-steps`) and its "Choose file" button. Importing shows real read and total counts. Payments are not counted until the parser is connected.
  - New dependencies `expo-document-picker` and `expo-file-system`; Maestro flow `import-backup.yml`.

- **Real backup import (`src/ledger`, `src/features/app`).** Importing a backup file now writes real rows. `ingest` parses each batch in one transaction with a savepoint per message, stores parsed messages and fragments, and re-derives each transaction with `mergeAll`, so re-importing or reordering gives identical rows and a user's annotation survives. `finishImport` links reversals and refunds and sets `meta.first_import_done`. All ledger writes go through one single-flight `writeQueue`. `DbProvider` migrates and seeds the database at startup. The Importing screen counts real payments and ends on "Import complete" with a summary (transactions, payments, spend for the latest month) and a Go to Home button. On the sample export: 1,913 parsed, 575 ignored, 1,640 transactions, 6 reversal links. Home and the other screens still show sample data; the category is a placeholder (`resolveCategoryStub`) until the categoriser lands.
- **First-run gate and Settings import row.** A fresh install now opens on Permission instead of Home (`FirstRunGate`, `decideStartRoute`, `meta.onboarding_choice`; rules in `docs/handoff.md` section 5). "Not now" saves the choice and goes to Home; it no longer opens Permission denied. Settings, under More, has "Import a backup file", which opens the same steps sheet and shows "Last imported <date>" (`meta.last_import_at`, set by `finishImport` on every run). `getMeta` and `setMeta` in `src/data/meta.ts`. Maestro: `setupApp.yml` skips onboarding through `_skipOnboarding.yml`; new `first-run-gate.yml` and `settings-import-row.yml`; `permission-flow.yml` now ends on Home. "Allow SMS access" is unchanged and still has no scan behind it.

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
