# Integration handoff

Read this before connecting the app to real data. It lists what is real, what is a stand-in, and where each stand-in plugs in. `docs/system-design.md` is the target architecture; this file is the gap between it and the code today. The change history is in [`CHANGELOG.md`](../CHANGELOG.md).

## 1. State in one paragraph

All 14 screens plus the month, calendar, category-filter and add-expense sheets are built. Only the backup import is real: `DbProvider` opens, migrates and seeds the database at startup, and importing an SMS Backup & Restore file parses it and writes real rows through `src/ledger`. Every other screen, Home included, still runs on sample data and does not read the database. There is no SMS module and no scan. `src/domain` is pure and tested; `src/features` and `src/ui` are UI only. Several screens look like they save but only change local React state.

## 2. Real versus stand-in

| Area | Today | Replace with |
|---|---|---|
| Money | Real. Integer pesewas in `src/domain/money.ts` (`parseAmount`, `formatGhs`, `formatPlain`, `splitGhs`) | Keep |
| Calendar maths | Real. `src/domain/calendar/week.ts` (UTC, Monday first) | Keep |
| Category shares | Real. `categoryShares` and `allocate` in `src/domain/category/share.ts` | Keep |
| Month summary shape | Real type, fake values. `MonthSummary` in `src/domain/summary/month.ts` | The summary query returns this |
| Transactions | Fake. `src/features/transactions/sample.ts` (`SAMPLE_DAYS`, `SAMPLE_RECENT`, `SAMPLE_DETAIL`) | List, recent and detail queries returning `TransactionRow` and `TransactionDetail` |
| Home month data | Fake. `src/features/home/sample.ts` (`SAMPLE_MONTH`, `summaryFor`) | Summary query per month |
| Category spend | Fake. `src/features/categories/sample.ts` (`SAMPLE_SPEND`) | SQL aggregate by category for the selected period |
| Months list | Fake. `src/features/period/months.ts` (`MONTH_OPTIONS`, May to Oct 2026, `CURRENT_MONTH` hard-coded) | Months that have data, from the database |
| Insights | Fake. `src/features/insights/sample.ts` (`MONTHS`, `WEEKDAYS`, `daySpend`, `weekdaySpend`, `WEEKDAY_WEIGHTS`) | Aggregates by month, by day and by weekday. `daySpend(iso)` should become a query by date |
| Categories | Seed only. `src/domain/category/seed.ts`, resolved by `src/features/categories/lookup.ts` | `categories` table; `categoryById` reads from it |
| Settings lists | Fake. `src/features/settings/sample.ts` (word counts, family and friend names, unread messages) | `keywords`, `name_lists` and the `unread_messages` view |
| "Today" | Device clock via `useToday()` | Keep; sample data assumes Tue 20 Oct 2026 |
| Permission, importing | Real for a picked backup file: progress, payments found, then an "Import complete" summary and a Home button. The "Allow SMS access" path is still sample | Wire "Allow SMS access" to the `momo-sms` module and scan |
| Ledger | Real. `src/ledger`: `ingest`, `finishImport`, `importSummary`, the write queue. Category is a placeholder (`categoryStub.ts`, section 5) | The categoriser piece replaces `resolveCategoryStub` |

Rules the code already follows: money is integer pesewas, dates are ISO `YYYY-MM-DD` in UTC (Ghana is UTC+0), the domain imports no React, Expo or SQLite (ESLint enforces it).

## 3. State that must move into storage

These hold user input in memory only. They reset on reload.

| Where | What it holds | Becomes |
|---|---|---|
| `ExpensesProvider` (`src/features/expenses`) | Expenses added by hand; also merged into Home totals, categories and recent, and into Transactions | `transactions` rows with `origin = 'manual'`, their category in `transaction_annotations` |
| `PeriodProvider` (`src/features/period`) | Selected month or day | UI state only. Keep as context or router params |
| `TransactionFilterProvider` (`src/features/transactions/filterContext.tsx`) | Selected category filter | UI state only |
| `NameList` (settings) | Family and friend names | `name_lists` |
| `EditCategoryScreen` | Words added and removed | `keywords` |
| `NewCategorySheet` | New category | `categories` |
| `UnreadMessagesScreen` | Ignored message ids | `message_dismissals`; "Add by hand" sets `transactions.source_message_id` |
| `TransactionDetailScreen`, `AddNoteSheet`, `CashOutSheet` | Note, category, "always tag this recipient" | `transaction_annotations` (category, note, snooze) and `recipient_rules` |
| `SettingsScreen` | Lock the app toggle | Real app lock (not built) |

## 4. Buttons that look like they save but do not

`Save changes` (`detailSaveBtn`), `Save note` (`addNoteSaveBtn`), `Save` (`cashOutSaveBtn`), `Create category` (`createCategoryBtn`), `Add by hand` (`unreadAdd-*`), `Copy text` only copies, `Delete this category` only closes. `Add expense` does keep its result, but only in memory.

## 5. Data layer, and what is not built yet

`src/data` holds the schema. Only `src/features/app` (`DbProvider`) and `src/ledger` use it, so every screen except Importing still runs on the stand-ins in section 2. The schema and the reasons for it are in [`data-model.md`](data-model.md); it supersedes `system-design.md` section 6.

- `db.ts` defines the async `Db` interface (`exec`, `run`, `all`, `get`, `transaction`) and `openDatabase(name?)`, the only file that imports `expo-sqlite`. `transaction` is exclusive and a nested call joins the open one.
- `migrate.ts` applies `src/data/migrations` in order with `PRAGMA user_version`, one transaction each. Migrations are `.ts` files exporting SQL strings because Metro cannot bundle `.sql`. Add the next one as `0002_*.ts` and append it to `migrations/index.ts`. Every table is STRICT, and triggers go through `execAsync` like any other statement.
- `0001_init` inserts the five protected categories (family, friends, income, cash, misc). `seedDatabase(db)` adds the other UI categories (`system_key` is the UI id; UI `other` is the Misc row) once per seed version and is safe to call on every launch. It seeds no keywords.
- Tests run in plain Node against `node:sqlite` through `src/data/__tests__/nodeDb.ts`, which implements `Db`.

Reading the data: totals come from the view `ledger_lines` (one SUM each for spend, income and fees; refunds and reversals are already netted), lists and detail from `transaction_list`. Both expose the effective category: the user's tag, else the categoriser's, else Misc. Writers: the ledger writes `sms_*`, SMS `transactions` and `auto_category_*`; the user's tag, note and snooze go only in `transaction_annotations`.

### Backup import and the ledger

Built: the schema, the reader, the Expo adapters, `importBackup`, the parser, and `src/ledger`. A picked file is read in batches of 200, each batch is parsed and written in one transaction, and `finishImport` closes the import. Home and the other screens do not read these rows yet.

- `src/ledger/writeQueue.ts`: `ledgerQueue.run(task)` serialises every ledger write in the process; `runCoalesced` is the single-flight variant for scans (a request made mid-run sets a rerun flag). Route every new ledger writer through it.
- `src/ledger/ingest.ts`: `ingest(db, items, now?)` takes `{ source: 'backup' | 'inbox', body, receivedAt, androidId? }`. One exclusive transaction per batch and a `SAVEPOINT` per message; a message that throws rolls back to its savepoint and is counted in `errors`. Parsed messages upsert `sms_messages` (backup key `<received_at>:<momo_txn_id>:<template_name>`) and `sms_fragments`, then the transaction is re-derived with `mergeAll` over all its stored fragments, so re-ingest and arrival order never change the result. Ignored and unparsed backup messages are only counted. Inbox messages are stored with their status (this is for the scan piece; nothing calls it with `inbox` yet). It never touches `transaction_annotations`. The result also carries `paymentIds` so a caller can count a payment whose two messages fall in different batches once (`createLedgerSink` does this).
- Inbox messages that throw are counted but not recorded as `error` rows yet; the scan piece should add that.
- `src/ledger/finishImport.ts`: links every unlinked credit with `linkReversals` (`linked_by 'auto'`, confidence `exact` or `ambiguous`) and sets `meta.first_import_done`, `first_import_at` (first run only) and `parser_version`. Safe to run again.
- `src/ledger/importSummary.ts`: transaction and payment counts plus net spend for the latest month with spend, from `ledger_lines`.
- `src/features/app`: `DbProvider` (renders nothing until migrate and seed finish; shows `dbErrorScreen` if they fail), `useDb`, and `createLedgerSink(db)`, the `ImportSink` that `startImport(uri, sink)` needs.
- The Importing screen shows `importSummary` text and `importHomeBtn` ("Go to Home") when the phase is `done`; the button goes to Home.
- **First-run gate.** `FirstRunGate` (`src/features/app`, mounted in `src/app/_layout.tsx` inside `DbProvider`) reads `meta` once after the database is ready, calls the pure `decideStartRoute` (`startRoute.ts`, loaded by `loadStartRoute.ts`) and does one `router.replace` per launch. The splash stays up until then, so Home never flashes. Rules: `first_import_done = '1'` or any `onboarding_choice` goes to tabs; otherwise an import in the `running` phase goes to `/importing`; otherwise `/permission`. It only acts when the app opened on `/`; a deep link, sheet or restored screen is left alone. If the meta read throws, the user stays on Home.
- **`meta.onboarding_choice`.** `'not_now'`, written by `recordNotNow` when the user taps Not now on Permission (`permissionNotNowBtn`) or "Keep looking around without it" on Permission denied. Both then go to Home. Without it the gate would send the user back to Permission on every launch. Permission denied is no longer reachable from Permission; only by the deep link `momospend://permission-denied`.
- **Where "Allow SMS access" leads today.** `allowSmsBtn` does `router.replace('/importing')` with no scan or permission request behind it (the Kotlin `momo-sms` module does not exist). The import phase stays `idle`, so Importing shows its labelled sample numbers, and nothing is written, so the next launch lands on Permission again. Replace it with the permission request and scan when the module lands.
- **Settings entry.** The More section has "Import a backup file" (`settingsImportBackupRow`). It opens `/sheets/import-steps` and the same import as first run. Its subtitle is "Last imported <date>" from `meta.last_import_at` (set on every finished import; falls back to `first_import_at`), else the hint text. Re-importing is safe because ingest is idempotent.
- **Reset to a fresh install:** `adb shell pm clear com.momospend.app` (dev build). Under Expo Go use `host.exp.exponent`. The next launch lands on Permission.
- **Maestro:** a fresh launch lands on Permission, so `maestro/setupApp.yml` runs `flows/_skipOnboarding.yml` (taps `permissionNotNowBtn` when visible). `first-run-gate.yml` and `settings-import-row.yml` are new and, like all flows, never run.
- Placeholders in the ledger: `resolveCategoryStub` (cash out is Cash, incoming is Income, everything else Misc, source `default`) in `src/ledger/categoryStub.ts` is the single seam the categoriser replaces; `is_self_transfer` is always 0; `reference_clean` is never set, so a transaction's note is empty until the categoriser cleans `sms_reference`.
- "Allow SMS access" still goes to Importing with no scan behind it, so the screen shows labelled sample numbers (`importSampleNote`).
- The real export (2,488 messages) gives 1,913 parsed, 575 ignored, 0 unparsed, 0 errors, 1,640 transactions (1,328 payments) and 6 reversal links. The optional test `src/ledger/__tests__/realFile.test.ts` checks this when `/mnt/c/Users/Desmond Opoku Mends/Downloads/sms-20260621002856.xml` exists and prints monthly totals; it never prints message text.
- Only `expoFileSource.ts` and `pickBackupFile.ts` may import Expo inside `src/backup` (ESLint enforces it, and bans `console` there because message bodies flow through).
- The picker filters on `text/xml` and `application/xml`. Some file managers label the export differently and will grey it out; widen the filter if that shows up.

Before connecting screens: the UI uses string category ids (`food`), the database uses integer ids with the string in `system_key`. `categoryById` in `src/features/categories/lookup.ts` needs a map between them. User-made categories have no `system_key` and no string id today.

Manual expenses are `transactions` rows with `origin = 'manual'`, `momo_txn_id` NULL, `occurred_at_source = 'user'`, `flow = 'spend'` and no auto category. The "what was it for" title goes in `counterparty_name` and the chosen category in `transaction_annotations.category_id`.

### How budgets will plug in

Budgets arrive as migration `0002` (`budgets` and `budget_alerts`, sketched in `data-model.md` and applied in `src/data/__tests__/budgets.test.ts`). `transactions` does not change. Spend against a limit is `SUM(pesewas) FROM ledger_lines WHERE bucket = 'spend' AND category_id = ? AND at >= ? AND at < ?`. The month's time range uses `transactions_time`; the category filter is applied after, because the effective category is a join result and `transactions_cat_time` cannot serve it. Category ids are never reused. `deleteCategory` must add the budget count to its confirmation, because the cascade removes those rows.

Still not built: `modules/momo-sms` (Kotlin module), `src/data/repos` and `queries`, the rest of `src/ledger` (recategorise, reparse, `deleteCategory`), `src/scan`.

### The SMS parser

`src/domain/parse` is pure and tested; `src/ledger/ingest.ts` is its only caller.

- `parseSms(sms: RawSms): ParseResult` classifies in the order OTP, no transaction-id label, failed, then the 11 templates in `registry.ts`. It never throws. A `parsed` result carries a `ParsedFragment`; the ledger writes it to `sms_fragments`.
- The ledger derives `flow` itself. Fragment `kind` to `flow`: `payment_out`, `cash_out`, `transfer_out` are `spend`; `payment_in`, `cash_in`, `interest` are `income`; `refund`, `reversal` are `credit`.
- `mergeAll(fragments)` folds every fragment of one `momo_txn_id` into the `transactions` fields. It is commutative (it sorts by `receivedAt`, `androidId`, template name first). `hasConflict` is set when two messages disagree on amount or kind. `fee` and `tax` are `null` when no message says; write `0` only at the end.
- `linkReversals(txns, existing)` returns only new links, each with `ambiguous`. Run it over all unlinked credits in `finishScan`. On the sample export it links all 6 (3 ambiguous). It never touches a link you pass in `existing`, so pass the user's links too.
- `reconcileBalances` is a check, not part of ingest. `npm run check:sms -- <export.xml>` prints parse rate, unparsed shapes (redacted), merge conflicts, reversal links and reconciliation, with no message text.
- `PARSER_VERSION` (in `parse/types.ts`) is 1. Bump it with any template change so `meta.parser_version` triggers a re-parse.
- `reference` is the raw text with only the sentence-final dot removed; `-` stays. `resolveCategory` does the cleaning. A `name ,233XXXXXXXXX,note` reference also fills `counterpartyNumber`.
- `Merchant NNNNNN` goes to `merchantCode` and leaves `counterpartyName` null.
- Fixtures are in `fixtures/sms` (see its README). Regenerate them with `npm run anonymise:sms -- <export.xml>` then `npx prettier --write fixtures`. The script also writes `.local/sms-denylist.txt` (ignored by version control); the fixtures test uses it when present.
- `scripts/lib/smsXml.ts` reads an SMS Backup & Restore file without a dependency. It handles single-quoted attributes (the exporter uses them for a body containing a double quote); the backup importer needs the same.

## 6. Things that will bite

- **Parser tie-breaks are by arrival, not by quality.** When two messages of one transaction state different non-null fees, taxes or balances, `mergeAll` keeps the one that arrived first. In the sample export they never differ. If MTN reorders delivery, check `hasConflict` and the fee fields first.
- **The "You have Paid" time is never parsed.** Its 12-digit value has no month (`yyyy` `dd` `HH` `mm` `ss`), so those rows use the received time. When the same transaction also arrives as "Your payment ... completed at <time>" the merge takes that body time.

- **A parser fix that changes a `momo_txn_id` orphans user edits.** The old transaction is retracted and the new one starts with no annotation or reversal link. The re-parse step must move `transaction_annotations` and `reversal_links` to the new row explicitly; the schema does not.
- **Deleting a category is a two-step.** `auto_category_id` is `RESTRICT`, so `deleteCategory` must recategorise first. Annotations are `SET NULL` and keep the note. Triggers refuse deleting the five protected categories and any `sms_messages` or SMS `transactions` row, even with `foreign_keys` OFF.
- **Money must be an integer.** STRICT tables reject 10.5 in a money column at insert time; pass pesewas.
- **Exclusive transactions open a new connection.** `expo-sqlite`'s `withExclusiveTransactionAsync` runs on a fresh native connection where `foreign_keys` is OFF and `BEGIN` is deferred. `db.ts` closes that `BEGIN`, sets the pragma, and reopens with `BEGIN IMMEDIATE`, then throws if the pragma did not stick. This is only exercised by the Node tests through a stand-in; run a RESTRICT delete inside `transaction` on a device before relying on it.
- **Maestro flows depend on sample ids** (`t1` to `t6`, category ids, `2026-10-*` dates). When data is real they need a seeded fixture or a test mode. They have never been run (Maestro is not installed in the WSL environment).
- **Privacy screen copy** says the app does not ask for internet access. That is only true once `INTERNET` is stripped from release builds (design requires it; not done). Dev builds need it for Metro.
- **Typed routes:** `.expo/types/router.d.ts` goes stale after adding routes and then `tsc` rejects new `router.push` paths locally. Delete the file; CI never has it.
- **Metro in CI mode** (`CI=1`) does not hot reload. Relaunch the app to pick up changes.
- **Dev client** built before `expo-clipboard` was added lacks the native module. Rebuild it (`npm run build:dev`). Copy text degrades to "Could not copy" instead of crashing.
- **Paper is out of date** for the Home totals and "+", Transactions Clear button, Transaction detail without fees, Add expense and the Insights calendar. Paper's weekly MCP limit was hit; update when it resets. `docs/design.md` section 8 is the source of truth meanwhile.
- **EAS:** project `momo-spend` under owner `desmends`, Android keystore is managed by EAS, versionCode is remote and auto-increments on production. Production builds an APK for now (change `build.production.android.buildType` to `app-bundle` for Play).
- **Git identity** for this repo is the Gmail address (`desmondopokumends2004@gmail.com`), set locally, so commits are credited to `Desmond123-arch`.

## 7. Checking your work

- `npm run check` runs typecheck, lint, format and the Jest suite with the 95% domain coverage gate.
- `.claude/skills/verify-momo-spend` drives the app on an adb emulator through Expo Go and reads `testID`s as resource-ids. Prefer `tap-id` and `has-id`.
- Every element a flow or test touches gets a camelCase `testID`; naming is in `maestro/README.md`.
