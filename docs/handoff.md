# Integration handoff

Read this before connecting the app to real data. It lists what is real, what is a stand-in, and where each stand-in plugs in. `docs/system-design.md` is the target architecture; this file is the gap between it and the code today. The change history is in [`CHANGELOG.md`](../CHANGELOG.md).

## 1. State in one paragraph

All 14 screens plus the month, calendar, category-filter and add-expense sheets are built. The backup import is real: `DbProvider` opens, migrates and seeds the database at startup, and importing an SMS Backup & Restore file parses it and writes real rows through `src/ledger`. Home, Transactions (list and detail), Insights and the month and calendar sheets now read those rows through `src/data/queries` and TanStack Query. What still runs on stand-ins is everything that writes or is not about money rows: Settings lists, add-expense, notes, category edits, name lists and unread messages (section 3). There is no SMS module and no scan. `src/domain` is pure and tested; `src/features` and `src/ui` are UI only. Several screens look like they save but only change local React state.

## 2. Real versus stand-in

| Area | Today | Replace with |
|---|---|---|
| Money | Real. Integer pesewas in `src/domain/money.ts` (`parseAmount`, `formatGhs`, `formatPlain`, `splitGhs`) | Keep |
| Calendar maths | Real. `src/domain/calendar/week.ts` (UTC, Monday first) | Keep |
| Category shares | Real. `categoryShares` and `allocate` in `src/domain/category/share.ts` | Keep |
| Month summary shape | Real. `MonthSummary` in `src/domain/summary/month.ts`, built by `buildMonthSummary` from `MonthFacts` that `monthFacts` (`src/data/queries/summary.ts`) reads | Keep |
| Transactions | Real. `listTransactions`, `recentPayments`, `transactionDetail` in `src/data/queries/transactions.ts`, through `useTransactions`, `useTransactionDetail` and `useHomeData`. Rows keep the domain `TransactionRow` and `TransactionDetail` shapes | Keep |
| Home month data | Real. `useHomeData` (`src/features/home`) | Keep |
| Category spend | Real. `categorySpend` over `ledger_lines`, hook `useCategorySpend` | Keep |
| Months list | Real. `monthsWithData` plus the current month, `useMonthOptions` and `PeriodProvider` in `src/features/period`. `MONTH_OPTIONS` and `CURRENT_MONTH` are gone | Keep |
| Insights | Real. `monthlyFlows` (six months), `daySpend`, `weekdayAverage` (the "not happened yet" average), hooks in `src/features/insights/useInsights.ts`. The weekday bar chart stays gone (design 8.5) | Keep |
| Categories | Real. `listCategories` feeds `useCategories` and `categoryById` (`src/features/categories/lookup.ts`); the seed is only the fallback before the first read. The add-expense, cash-out, add-note and detail pickers still list `SEED_CATEGORIES` (piece 4b) | Move those pickers to `useCategories()` |
| Categoriser | Real. `src/domain/categorise` (pure) and `src/ledger/categorise.ts` (loads the config, calls it) | Keep |
| Settings lists | Fake. `src/features/settings/sample.ts` (word counts, family and friend names, unread messages) | `keywords`, `name_lists` and the `unread_messages` view; after any edit call `recategorise(db)` |
| "Today" | Device clock via `useToday()` (UTC dates) | Keep |
| Permission, importing | Real for a picked backup file: progress, payments found, then an "Import complete" summary and a Home button. The "Allow SMS access" path is still sample | Wire "Allow SMS access" to the `momo-sms` module and scan |
| Ledger | Real. `src/ledger`: `ingest`, `finishImport`, `importSummary`, the write queue. Categories are real (`src/ledger/categorise.ts`, `recategorise.ts`, section 5) | Keep |

Rules the code already follows: money is integer pesewas, dates are ISO `YYYY-MM-DD` in UTC (Ghana is UTC+0), the domain imports no React, Expo or SQLite (ESLint enforces it).

## 3. State that must move into storage

These hold user input in memory only. They reset on reload.

| Where | What it holds | Becomes |
|---|---|---|
| `ExpensesProvider` (`src/features/expenses`) | Expenses added by hand; folded into Home totals, categories and recent, and into Transactions by `src/features/expenses/merge.ts` (only for the current month) | `transactions` rows with `origin = 'manual'`, their category in `transaction_annotations`. The queries already return such rows, so delete `merge.ts` and its callers (`HomeScreen`, `TransactionsScreen`, `TransactionDetailScreen`) when the writes land |
| `PeriodProvider` (`src/features/period`) | Selected month or day (months come from the database) | UI state only. Keep as context or router params |
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

`src/data` holds the schema and the read queries. `src/features/app` (`DbProvider`), `src/ledger` and the read hooks in `src/features` use it. The schema and the reasons for it are in [`data-model.md`](data-model.md); it supersedes `system-design.md` section 6.

- `db.ts` defines the async `Db` interface (`exec`, `run`, `all`, `get`, `transaction`) and `openDatabase(name?)`, the only file that imports `expo-sqlite`. `transaction` is exclusive and a nested call joins the open one.
- `migrate.ts` applies `src/data/migrations` in order with `PRAGMA user_version`, one transaction each. Migrations are `.ts` files exporting SQL strings because Metro cannot bundle `.sql`. Add the next one as `0002_*.ts` and append it to `migrations/index.ts`. Every table is STRICT, and triggers go through `execAsync` like any other statement.
- `0001_init` inserts the five protected categories (family, friends, income, cash, misc). `seedDatabase(db)` adds the other UI categories (`system_key` is the UI id; UI `other` is the Misc row) once per seed version and is safe to call on every launch. Seed step 2 adds six categories (`electronics`, `entertainment`, `personalcare`, `giving`, `savings`, `services`) and the seed keywords (`origin = 'seed'`, aliases `is_alias = 1`), and sets `sort_order` of the keyword categories to the priority in `docs/categorisation.md` (200 and up). Keywords are inserted once per seed version, so a deleted word never returns; a word the user already added keeps its owner. UI `other` is still in `SEED_CATEGORIES` because samples use it; it maps to Misc and goes when the screens read the database.
- Tests run in plain Node against `node:sqlite` through `src/data/__tests__/nodeDb.ts`, which implements `Db`.

Reading the data: totals come from the view `ledger_lines` (one SUM each for spend, income and fees; refunds and reversals are already netted), lists and detail from `transaction_list`. Both expose the effective category: the user's tag, else the categoriser's, else Misc. Writers: the ledger writes `sms_*`, SMS `transactions` and `auto_category_*`; the user's tag, note and snooze go only in `transaction_annotations`.

### Backup import and the ledger

Built: the schema, the reader, the Expo adapters, `importBackup`, the parser, `src/ledger` and the read queries. A picked file is read in batches of 200, each batch is parsed and written in one transaction, and `finishImport` closes the import. `QueryProvider` invalidates every cached query when the import store reaches `done`, so Home shows the import without a restart.

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
- **Categoriser in the ledger.** `categorise(facts, ctx)` in `src/ledger/categorise.ts` is the only seam. `loadCategoriserContext(tx)` reads categories, keywords, `name_lists`, `recipient_rules` and `meta.owner_number` / `owner_name` once per ingest batch. `ingest` writes `auto_category_id`, `auto_category_source`, `reference_clean` (the note, original case kept) and `is_self_transfer`. `recategorise(db)` (queued, one transaction) and `recategoriseIn(tx)` (for callers already in the queue, as `finishImport` is) overwrite those four columns for every SMS row and never touch `transaction_annotations`. Call `recategorise` after any edit to keywords, names, rules or categories. The manual tag is rule 1 of the contract but lives in the annotation, so `resolveCategory(facts, config)` has no manual argument.
- Matching details that differ from a literal reading of the spec: incoming money and cash-outs skip the reference and go to Income and Cash, but a recipient rule (scoped by `applies_to`) still applies to them; refunds and reversals are Misc (their effective category comes from the original through `ledger_lines`); a priority tie between categories is broken by `categories.sort_order`, so a new user category must get a `sort_order` after the seeded ones (200 and up), not the default 0.
- Family and friends name lists start empty, so no transaction is Family or Friends until the user adds names. Add names, then call `recategorise`.
- "Allow SMS access" still goes to Importing with no scan behind it, so the screen shows labelled sample numbers (`importSampleNote`).
- The real export (2,488 messages) gives 1,913 parsed, 575 ignored, 0 unparsed, 0 errors, 1,640 transactions (1,328 payments) and 6 reversal links. The optional test `src/ledger/__tests__/realFile.test.ts` checks this when `/mnt/c/Users/Desmond Opoku Mends/Downloads/sms-20260621002856.xml` exists and prints monthly totals; it never prints message text.
- Only `expoFileSource.ts` and `pickBackupFile.ts` may import Expo inside `src/backup` (ESLint enforces it, and bans `console` there because message bodies flow through).
- The picker filters on `text/xml` and `application/xml`. Some file managers label the export differently and will grey it out; widen the filter if that shows up.

### Reading the data (piece 4a)

Every read is a function in `src/data/queries` over the `Db` interface (listed in `data-model.md`), wrapped by a TanStack Query hook in the feature that uses it. Keys include the month, day and filters. After a write, call `useQueryClient().invalidateQueries()` (all of it derives from SQLite) or the narrower `CATEGORIES_KEY` from `src/features/categories`.

- **Category ids.** The UI keeps string ids. `UI id = system_key`, except that the migration's `misc` row is `other` (the id the UI always used); a user category has no key and uses its row id as a string (`'12'`). `uiCategoryId` (`src/domain/category/ids.ts`) and `UI_CATEGORY_ID_SQL` (`src/data/queries/sql.ts`) are the two statements of the rule; the query tests exercise the SQL one. `Cash` (`cash`) now exists in the UI list and shows in legends, rows and the category filter.
- **Which month opens.** `PeriodProvider` follows the data until the user picks something: the current month when it has data (or nothing has data at all), otherwise the latest month with data. A backup export is usually older than today, so Home opens on its newest month instead of an empty current one. The current month is always in the month and calendar sheets. Home shows a blank screen (`homeLoading`) until the months have been read, so it never flashes the wrong month.
- **Empty states.** Home with no data anywhere keeps "Nothing here yet." If other months have data, an empty month reads "No payments in <month>." and points to the month picker. Transactions and Insights say the same for an empty month.
- **Transactions follows the month** picked on Home (there is no month control on that screen). Direction, category and search are SQL filters (`LIKE` on name, note and category name, ASCII case-insensitive). "See all N" on Home counts payments (money out); the list also shows money in, so its row count is larger.
- **What counts as a payment.** `flow = 'spend'`, retracted rows excluded, self-transfers included. Credits (refunds, reversals) are money in on the list and offset spend in the totals.
- **"What were these for?"** `needsNoteCount` counts outgoing SMS payments in the Misc category with no note of any kind (a user note, a cleared note and a clean reference all count as answered), not snoozed, and occurring after `meta.first_import_at`. With no `first_import_at` nothing is counted. A backup import therefore shows no card. Rows in the list show the yellow "Add a note" state by the same rule (out, no note, Misc, not hand-added); the old rule (any row with a null note) would have marked every imported row. `needsNoteList` exists for the Add note sheet (piece 4b) but nothing calls it yet.
- **Transaction detail.** The time shows "about" when `occurred_at_source = 'received'`, and the year when it is not the current one. "Balance after" is hidden when there is none. The line under the amount says if the payment was reversed or reverses another. Message text is never stored, so the "Original message" toggle opens a line saying so (`originalMessage` is null until the inbox scan can read it back). A route id that is not a stored transaction shows `detailNotFound` (hand-added expenses resolve from `ExpensesProvider`). The note, category chips, "always tag" and Save are still local state.
- **Counterparty fallback.** A message with no name or merchant shows `Cash out`, `Interest`, `Refund`, `Reversal` or `MoMo payment` (`fallbackCounterparty`).
- **Placeholder categories.** Until the categoriser lands, imported payments are Cash (cash-out) or Misc and money in is Income, so the legends are mostly Other. Nothing in the read side changes when it lands.
- **Times** are UTC and ranges are `[start, end)`; the daily chart, the biggest day and the day view use the same UTC dates.

Manual expenses are `transactions` rows with `origin = 'manual'`, `momo_txn_id` NULL, `occurred_at_source = 'user'`, `flow = 'spend'` and no auto category. The "what was it for" title goes in `counterparty_name` and the chosen category in `transaction_annotations.category_id`.

### How budgets will plug in

Budgets arrive as migration `0002` (`budgets` and `budget_alerts`, sketched in `data-model.md` and applied in `src/data/__tests__/budgets.test.ts`). `transactions` does not change. Spend against a limit is `SUM(pesewas) FROM ledger_lines WHERE bucket = 'spend' AND category_id = ? AND at >= ? AND at < ?`. The month's time range uses `transactions_time`; the category filter is applied after, because the effective category is a join result and `transactions_cat_time` cannot serve it. Category ids are never reused. `deleteCategory` must add the budget count to its confirmation, because the cascade removes those rows.

Still not built: `modules/momo-sms` (Kotlin module), `src/data/repos` (writes), the rest of `src/ledger` (reparse, `deleteCategory`), `src/scan`.

### The SMS parser

`src/domain/parse` is pure and tested; `src/ledger/ingest.ts` is its only caller.

- `parseSms(sms: RawSms): ParseResult` classifies in the order OTP, no transaction-id label, failed, then the 11 templates in `registry.ts`. It never throws. A `parsed` result carries a `ParsedFragment`; the ledger writes it to `sms_fragments`.
- The ledger derives `flow` itself. Fragment `kind` to `flow`: `payment_out`, `cash_out`, `transfer_out` are `spend`; `payment_in`, `cash_in`, `interest` are `income`; `refund`, `reversal` are `credit`.
- `mergeAll(fragments)` folds every fragment of one `momo_txn_id` into the `transactions` fields. It is commutative (it sorts by `receivedAt`, `androidId`, template name first). `hasConflict` is set when two messages disagree on amount or kind. `fee` and `tax` are `null` when no message says; write `0` only at the end.
- `linkReversals(txns, existing)` returns only new links, each with `ambiguous`. Run it over all unlinked credits in `finishScan`. On the sample export it links all 6 (3 ambiguous). It never touches a link you pass in `existing`, so pass the user's links too.
- `reconcileBalances` is a check, not part of ingest. `npm run check:sms -- <export.xml>` prints parse rate, unparsed shapes (redacted), merge conflicts, reversal links and reconciliation, with no message text.
- `PARSER_VERSION` (in `parse/types.ts`) is 1. Bump it with any template change so `meta.parser_version` triggers a re-parse.
- `reference` is the raw text with only the sentence-final dot removed; `-` stays. `cleanReference` in `src/domain/categorise/reference.ts` does the cleaning. A `name ,233XXXXXXXXX,note` reference also fills `counterpartyNumber`.
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
- **Maestro flows depend on sample data and now break.** They have never been run (Maestro is not installed in the WSL environment). They need a seeded database or a test mode that loads a fixture ledger. Without data Home renders `homeEmptyState`, not `homeScreen`, so:
  - every flow that runs `setupApp.yml` fails at its wait for `homeScreen` (all except `first-run-gate.yml`), and `first-run-gate.yml` and `permission-flow.yml` fail at their `homeScreen` assertions;
  - on top of that these assert sample content: `home-screen` (`homeSpentAmount`, `dailyChart`, `needsNoteCard`), `add-note-category` (`needsNoteCard`), `home-filter` (`transactionRow-t1`, `-t2`), `transactions-filters` (`-t1`, `-t4`, `addNoteLink-t5`), `transactions-search` (`-t1` to `-t3`), `transaction-detail` (`transactionRow-t3`, the original message text), `month-picker` (`monthOption-2026-08`) and `insights-calendar` (`calendarDay-2026-10-19`, `-28`, `calendarMonth-2026-08`, "Monday 19 Oct").

  A fixture should also set `meta.first_import_at` before the sample payments so the needs-a-note card appears. New test ids: `homeLoading`, `detailLoading`, `detailNotFound`, `insightsMonthEmpty`.
- **Privacy screen copy** says the app does not ask for internet access. That is only true once `INTERNET` is stripped from release builds (design requires it; not done). Dev builds need it for Metro.
- **Typed routes:** `.expo/types/router.d.ts` goes stale after adding routes and then `tsc` rejects new `router.push` paths locally. Delete the file; CI never has it.
- **Metro in CI mode** (`CI=1`) does not hot reload. Relaunch the app to pick up changes.
- **Dev client** built before `expo-clipboard` was added lacks the native module. Rebuild it (`npm run build:dev`). Copy text degrades to "Could not copy" instead of crashing.
- **Paper is out of date** for the Home totals and "+", Transactions Clear button, Transaction detail without fees, Add expense and the Insights calendar. Paper's weekly MCP limit was hit; update when it resets. `docs/design.md` section 8 is the source of truth meanwhile.
- **EAS:** project `momo-spend` under owner `desmends`, Android keystore is managed by EAS, versionCode is remote and auto-increments on production. Production builds an APK for now (change `build.production.android.buildType` to `app-bundle` for Play).
- **Git identity** for this repo is the Gmail address (`desmondopokumends2004@gmail.com`), set locally, so commits are credited to `Desmond123-arch`.

## 7. Checking your work

- `npm run check:categories -- <export.xml>` ingests an export in memory and prints the category split and redacted skeletons of unmatched references (counts only).
- `npm run check` runs typecheck, lint, format and the Jest suite with the 95% domain coverage gate.
- `.claude/skills/verify-momo-spend` drives the app on an adb emulator through Expo Go and reads `testID`s as resource-ids. Prefer `tap-id` and `has-id`.
- Every element a flow or test touches gets a camelCase `testID`; naming is in `maestro/README.md`.
