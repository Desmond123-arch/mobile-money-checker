# Integration handoff

Read this before connecting the app to real data. It lists what is real, what is a stand-in, and where each stand-in plugs in. `docs/system-design.md` is the target architecture; this file is the gap between it and the code today. The change history is in [`CHANGELOG.md`](../CHANGELOG.md).

## 1. State in one paragraph

All 14 screens plus the month, calendar, category-filter and add-expense sheets are built. The backup import is real: `DbProvider` opens, migrates and seeds the database at startup, and importing an SMS Backup & Restore file parses it and writes real rows through `src/ledger`. Home, Transactions (list and detail), Insights and the month and calendar sheets read those rows through `src/data/queries` and TanStack Query, and every button that saves now writes to SQLite through `src/ledger` (hand-added expenses, notes, category tags, recipient rules, categories and their words, family and friends names, ignored messages; section 4). Live SMS reading is written and tested against a fake module, but its Kotlin has never been compiled or run (section 5, "Live SMS reading"). What is still a stand-in is small: "Lock the app" (section 3). `src/domain` is pure and tested; `src/features` and `src/ui` are UI only.

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
| Categories | Real. `listCategories` feeds `useCategories` and `categoryById` (`src/features/categories/lookup.ts`); the seed is only the fallback before the first read. Every picker (add-expense, cash-out, add-note, detail, filter) lists `useCategories()` | Keep |
| Categoriser | Real. `src/domain/categorise` (pure) and `src/ledger/categorise.ts` (loads the config, calls it) | Keep |
| Settings lists | Real. Word counts come from `keywords` (`keywordCounts`), family and friend names from `name_lists` (`nameLists`), the unread count from the `unread_messages` view. `sample.ts` is deleted | Keep |
| Hand-added expenses | Real. `addManualExpense` (`src/ledger/manualExpense.ts`). `ExpensesProvider` and `merge.ts` are deleted; the views return manual rows | Keep |
| "Today" | Device clock via `useToday()` (UTC dates) | Keep |
| Permission, importing | Real for a picked backup file. "Allow SMS access" now asks for `READ_SMS` and runs the first scan through the same import store and Importing screen. Built, not run on a device | Compile `modules/momo-sms` in a dev build and run the manual tests in section 5 |
| Ledger | Real. `src/ledger`: `ingest`, `finishImport`, `importSummary`, the write queue, and the user-side writes (`manualExpense`, `transactionEdit`, `categories`, `names`, `unread`). Categories are real (`src/ledger/categorise.ts`, `recategorise.ts`, section 5) | Keep |

Rules the code already follows: money is integer pesewas, dates are ISO `YYYY-MM-DD` in UTC (Ghana is UTC+0), the domain imports no React, Expo or SQLite (ESLint enforces it).

## 3. What is still in memory or not built

Nothing a user types is lost on reload any more, except these.

| Where | What it holds | Becomes |
|---|---|---|
| `PeriodProvider` (`src/features/period`) | Selected month or day (months come from the database) | UI state only. Keep as context or router params |
| `TransactionFilterProvider` (`src/features/transactions/filterContext.tsx`) | Selected category filter | UI state only |
| `SettingsScreen` | "Lock the app" toggle. A stand-in: the switch moves and the subtitle says "Not built yet" | Real app lock (`meta` lock flag, biometric or PIN) |

## 4. Buttons that save, and what is left

These now persist. Each runs one queued exclusive transaction (`ledgerQueue.run` then `db.transaction`), then invalidates query key prefixes (`useWrite`, `src/features/app/useWrite.ts`: `money` or `settings`). Each has a test that closes and reopens a database file and reads the result back (`createFileDb`, `src/ledger/__tests__/fileDb.ts`).

| Button (testID) | Writes | Test |
|---|---|---|
| Add expense (`addExpenseSaveBtn`) | `transactions` (origin `manual`) plus the category in `transaction_annotations` | `manualExpense.test.ts` |
| Save changes (`detailSaveBtn`) | Note and category in `transaction_annotations`, only the fields that changed | `transactionEdit.test.ts` |
| Always tag this recipient (`detailAlwaysTagToggle`) | A `recipient_rules` row (number, else merchant code, else normalised name), `applies_to` the transaction's flow, then `recategoriseIn` | `transactionEdit.test.ts` |
| Save note (`addNoteSaveBtn`) | Note and/or category in `transaction_annotations` | `transactionEdit.test.ts` |
| Save and Ask me later (`cashOutSaveBtn`, `cashOutAskLaterLink`) | Category and note, or `prompt_snoozed_until` (24 hours ahead) | `transactionEdit.test.ts` |
| Create category (`createCategoryBtn`) | `categories` (sort_order above the seeded ones, tint from the colour) and any starting `keywords`, then recategorise | `categories.test.ts` |
| Add a word, remove a word, suggestion chips | `keywords`, then recategorise | `categories.test.ts` |
| Delete this category (`deleteCategoryBtn`) | `deleteCategory` (system-design 7.8) | `categories.test.ts` |
| Family and friends Add name / remove | `name_lists`, then recategorise | `namesUnread.test.ts` |
| Ignore (`unreadIgnore-*`) | `message_dismissals` | `namesUnread.test.ts` |
| Add by hand (`unreadAdd-*`) | `transactions` with `source_message_id`, dated at the message's `received_at` | `namesUnread.test.ts` |

Behaviour worth knowing:

- Notes and the manual category are written only to `transaction_annotations`. `note = ''` means the user cleared the SMS reference. The detail screen sends a field only when it changed, so an untouched category keeps following the categoriser.
- The "What were these for?" card and the Transactions "Add a note" link open `/sheets/add-note`. The link passes `?id=`; the card passes nothing and the sheet takes the newest payment in the selected month from `needsNoteList`. A saved note or a category other than Misc removes the row from the card and the list.
- The cash-out sheet opens from a "What was this for?" link on a Transactions row in Cash with no note (`cashOutLink-<id>`), with `?id=`. The link shows only while the row is in `cashOutPrompts` (`useCashOutPrompts`), so "Ask me later" hides it for 24 hours. The card on Home counts these too and opens the newest one in the cash-out sheet first (`/sheets/cash-out?id=`); with none left it opens the Add note sheet.
- A word belongs to one category. Adding one that exists elsewhere, or one of the junk references (`momo`, `no`, ...), is refused with a message. Family, Friends, Income, Cash and Other take no words; their edit screen says why. Aliases are listed with the words and can be removed.
- A name belongs to one list. Adding it to the other list is refused with a message.
- Only user-made categories (no `system_key`) can be deleted, so the button is hidden for the others. The confirmation shows the transaction, word, rule and (once the `budgets` table exists) budget counts. Payments move to Other, manual tags on it become Other, notes stay.
- The "Words you removed" section of the edit screen offers seed words the user deleted. It replaced the hardcoded "People often add" list.
- **Messages we couldn't read** lists inbox rows only, and message text is never stored. So the list is empty after a backup import (by design) and until the inbox scan exists. Rows show a time and "Format not known yet", not the text. "Copy text" is gone because there is nothing to copy; `expo-clipboard` is no longer used by any screen.

Still not built: "Lock the app", reparse. `modules/momo-sms` and `src/scan` exist but are unverified on a device (section 5).

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
- Inbox messages that throw are counted and stored as `status = 'error'`, `reason = 'error:ingest'` rows, so they show under "Messages we couldn't read" and the scan does not re-read them. Only reparse (not built) will retry them.
- `src/ledger/finishImport.ts`: links every unlinked credit with `linkReversals` (`linked_by 'auto'`, confidence `exact` or `ambiguous`) and sets `meta.first_import_done`, `first_import_at` (first run only) and `parser_version`. Safe to run again.
- `src/ledger/importSummary.ts`: transaction and payment counts plus net spend for the latest month with spend, from `ledger_lines`.
- `src/features/app`: `DbProvider` (renders nothing until migrate and seed finish; shows `dbErrorScreen` if they fail), `useDb`, and `createLedgerSink(db)`, the `ImportSink` that `startImport(uri, sink)` needs.
- The Importing screen shows `importSummary` text and `importHomeBtn` ("Go to Home") when the phase is `done`; the button goes to Home.
- **First-run gate.** `FirstRunGate` (`src/features/app`, mounted in `src/app/_layout.tsx` inside `DbProvider`) reads `meta` once after the database is ready, calls the pure `decideStartRoute` (`startRoute.ts`, loaded by `loadStartRoute.ts`) and does one `router.replace` per launch. The splash stays up until then, so Home never flashes. Rules: `first_import_done = '1'` or any `onboarding_choice` goes to tabs; otherwise an import in the `running` phase goes to `/importing`; otherwise `/permission`. It only acts when the app opened on `/`; a deep link, sheet or restored screen is left alone. If the meta read throws, the user stays on Home.
- **`meta.onboarding_choice`.** `'not_now'`, written by `recordNotNow` when the user taps Not now on Permission (`permissionNotNowBtn`) or "Keep looking around without it" on Permission denied. Both then go to Home. Without it the gate would send the user back to Permission on every launch. Permission denied is no longer reachable from Permission; only by the deep link `momospend://permission-denied`.
- **Where "Allow SMS access" leads.** `allowSmsBtn` calls `useRequestSms` (`src/features/app/useRequestSms.ts`). Granted: `afterGrant` starts the first scan (`scanFirst`) and the app goes to Importing, which shows real progress from the import store (`kind: 'scan'`) and then "Import complete" with a Home button. Denied or undetermined: `/permission-denied` (design 3.1, "Try again" `permissionTryAgainBtn`, "Open phone settings" `openPhoneSettingsBtn`). Blocked: `/permission-denied?state=blocked`, the same screen with the Android 13+ restricted-settings steps and "Open Settings" (`Linking.openSettings`). Granted with zero MobileMoney ids: Importing replaces itself with `/no-messages` (`noMessagesScreen`; MIUI, Tecno and Infinix hint, "Check again", "Import a backup file", "Keep looking around without it"). A build with no native module (Expo Go) shows `allowSmsUnavailableNote`. The denied screen also re-checks the status when the app returns from phone settings and continues by itself if it is now granted.
- **Settings entry.** The More section has "Import a backup file" (`settingsImportBackupRow`). It opens `/sheets/import-steps` and the same import as first run. Its subtitle is "Last imported <date>" from `meta.last_import_at` (set on every finished import; falls back to `first_import_at`), else the hint text. Re-importing is safe because ingest is idempotent.
- **Reset to a fresh install:** `adb shell pm clear com.momospend.app` (dev build). Under Expo Go use `host.exp.exponent`. The next launch lands on Permission.
- **Maestro:** a fresh launch lands on Permission, so `maestro/setupApp.yml` runs `flows/_skipOnboarding.yml` (taps `permissionNotNowBtn` when visible). `first-run-gate.yml` and `settings-import-row.yml` are new and, like all flows, never run.
- **Categoriser in the ledger.** `categorise(facts, ctx)` in `src/ledger/categorise.ts` is the only seam. `loadCategoriserContext(tx)` reads categories, keywords, `name_lists`, `recipient_rules` and `meta.owner_number` / `owner_name` once per ingest batch. `ingest` writes `auto_category_id`, `auto_category_source`, `reference_clean` (the note, original case kept) and `is_self_transfer`. `recategorise(db)` (queued, one transaction) and `recategoriseIn(tx)` (for callers already in the queue, as `finishImport` is) overwrite those four columns for every SMS row and never touch `transaction_annotations`. Call `recategorise` after any edit to keywords, names, rules or categories. The manual tag is rule 1 of the contract but lives in the annotation, so `resolveCategory(facts, config)` has no manual argument.
- Matching details that differ from a literal reading of the spec: incoming money and cash-outs skip the reference and go to Income and Cash, but a recipient rule (scoped by `applies_to`) still applies to them; refunds and reversals are Misc (their effective category comes from the original through `ledger_lines`); a priority tie between categories is broken by `categories.sort_order`, so a new user category must get a `sort_order` after the seeded ones (200 and up), not the default 0.
- Family and friends name lists start empty, so no transaction is Family or Friends until the user adds names. Add names, then call `recategorise`.
- Importing shows labelled sample numbers (`importSampleNote`) only when opened with no import or scan running (the deep link `momospend://importing`).
- The real export (2,488 messages) gives 1,913 parsed, 575 ignored, 0 unparsed, 0 errors, 1,640 transactions (1,328 payments) and 6 reversal links. The optional test `src/ledger/__tests__/realFile.test.ts` checks this when `/mnt/c/Users/Desmond Opoku Mends/Downloads/sms-20260621002856.xml` exists and prints monthly totals; it never prints message text.
- Only `expoFileSource.ts` and `pickBackupFile.ts` may import Expo inside `src/backup` (ESLint enforces it, and bans `console` there because message bodies flow through).
- The picker filters on `text/xml` and `application/xml`. Some file managers label the export differently and will grey it out; widen the filter if that shows up.

### Live SMS reading (milestone M1)

**State: written and unit-tested against a fake; the Kotlin has never been compiled, and nothing has run on a phone.** The lead runs an EAS dev build (`npm run build:dev`) to compile it. Do not call this verified until the manual list below passes.

What is real, in the JS and SQL that Node can run:

- `modules/momo-sms` (Kotlin plus `src/index.ts`). Surface and APIs used are in `modules/momo-sms/README.md`. `READ_SMS` only, declared in `app.json` `android.permissions`. Only `src/scan` may import it (ESLint `no-restricted-imports`; `src/scan/nativeSms.ts` is the one import). The binding loads the native module on first call, so Expo Go starts and a scan there ends as `failed`.
- `src/scan/scan.ts`: `createScanner({ db, sms, onProgress })`. One scan: permission, `listMomoMessageIds`, diff against `sms_messages` inbox rows, retire gone and replaced rows (`gone_at`), revive a row that returns with the same id and date, read unseen ids in pages of 500, `ingest` with `source: 'inbox'`, then `finishScan` (`src/ledger/finishScan.ts`: link all unlinked reversals, `first_import_done`, `first_import_at` only if unset, `parser_version`, recategorise; it leaves `last_import_at` to backups). It goes through `ledgerQueue.runCoalesced`, so a request made mid-scan reruns once. Outcomes: `ok`, `no_permission`, `no_messages`, `failed`.
- Message identity: a seen id whose `received_at` differs is a reused id. The old row gets `gone_at`, a new row is inserted. `source_on_phone` is derived from `gone_at` by the view, so nothing else is written for missing messages.
- OTP: Kotlin returns `{ body: null, isOtp: true }`. The scan hands the parser the stub `<#>`, so the row is stored as `ignored` with reason `otp` and the code never exists in JS. A second sender check in `scan.ts` drops any row whose sender is not `MobileMoney`.
- `src/features/app/scanController.ts` and `ScanProvider.tsx`: triggers are cold start, `AppState` becoming `active`, the inbox observer (attached only after a scan saw access, detached in the background) and the manual button. Before `first_import_done` a trigger becomes the announced first scan (import store, `kind: 'scan'`); afterwards it is silent and invalidates queries when data changed.
- `decideStartRoute` takes `smsGranted`. Granted with no finished import resumes at `/importing`, so a scan killed halfway restarts on the next launch.
- Home shows `smsOffBanner` (`smsOffBannerBtn`) over stored data when the permission is not granted. Settings has `settingsCheckMessagesRow` ("Check for new messages") after "Import a backup file". The empty Home's `checkMessagesBtn` now scans too.
- Tests (all with `src/scan/__tests__/fakeMomoSms.ts`): new, replaced, missing, reused and revived ids; ignored and unparsed rows; OTP text absent from the database; another sender ignored; two concurrent calls; the rerun flag with a message arriving mid-scan; denied, blocked and undetermined; zero ids; a failed read storing nothing and a failure on page two keeping page one; ids 999 and 1000 compared as integers; paging 500, 500, 1; a message that fails to ingest becoming an `error` row; the triggers; the controller's store updates; `decideStartRoute` and `loadStartRoute`.

Differences from `system-design.md` section 8 (the doc now says so): `getPermissionStatus()` returns `'granted' | 'denied' | 'blocked' | 'undetermined'` instead of `hasPermission()`; `listMomoMessageIds()` takes no argument and the sender is a constant in Kotlin; `readMessageById` (single) is not built, because the detail screen's "Original message" still says the text is not stored; the 1 s debounce is in Kotlin, not JS; the sender match is `LIKE`, so case-insensitive.

**Needs the dev build.** Compile, then check: the Kotlin API calls (the README lists each), the `LIKE` selection on the SMS provider, `canAskAgain` mapping to `blocked`, the `ContentObserver`, `Long` ids across the bridge, and the 1 s debounce.

**Manual test list for a real phone** (a dev build for 1 to 4, a release-style APK sideloaded from a browser or file manager for 5):

1. Fresh install, tap Allow SMS access, allow. Importing counts up to the inbox's MobileMoney total, "Import complete" matches the count, Home shows the months. Time it: 2,000 messages should take under 10 s.
2. Delete the newest MobileMoney SMS in the Messages app, open momo-spend (the scan runs on foreground). Its transaction stays, with `source_on_phone` = 0. Then receive or restore another MoMo SMS, which can reuse the deleted id. After a scan it appears as a new transaction and the old row stays gone (check `sms_messages`: two rows for that id, the old one with `gone_at`).
3. With the app open, receive a MoMo payment SMS. Within about 2 s of the message Home updates with no tap (observer plus 1 s debounce). Send the app to the background, receive one, return: it appears (foreground trigger).
4. Settings, "Check for new messages": "Nothing new" when current, "N new messages read" after a delete-and-restore of a backup (restored messages keep old dates and get new ids).
5. Android 13+ restricted settings: sideload the APK with a file manager, tap Allow SMS access. Expect the blocked screen (no system dialog). Follow it: App info, three dots, Allow restricted settings, back, Try again, allow. Then the scan runs. An `adb install` hides this problem, so do not test it that way.
6. Deny the dialog once: Permission denied with Try again. Deny with "don't ask again": the next Try again gives the blocked screen. Revoke SMS in system settings with data present: Home shows the "SMS access is off" banner over the stored data, and its button recovers.
7. MIUI or Tecno/Infinix: with the hidden-sender toggle off, expect the "We can't see any MobileMoney messages" screen. Turn the toggle on, tap Check again.
8. Kill the app during the first scan, reopen: it resumes behind Importing.
9. Privacy: put an SMS from another sender and a `<#>` OTP in the inbox. Neither text appears anywhere (inspect the database through `run-as`; the OTP row is `ignored` / `otp`).

### Reading the data (piece 4a)

Every read is a function in `src/data/queries` over the `Db` interface (listed in `data-model.md`), wrapped by a TanStack Query hook in the feature that uses it. Keys include the month, day and filters. After a write, call `useQueryClient().invalidateQueries()` (all of it derives from SQLite) or the narrower `CATEGORIES_KEY` from `src/features/categories`.

- **Category ids.** The UI keeps string ids. `UI id = system_key`, except that the migration's `misc` row is `other` (the id the UI always used); a user category has no key and uses its row id as a string (`'12'`). `uiCategoryId` (`src/domain/category/ids.ts`) and `UI_CATEGORY_ID_SQL` (`src/data/queries/sql.ts`) are the two statements of the rule; the query tests exercise the SQL one. `Cash` (`cash`) now exists in the UI list and shows in legends, rows and the category filter.
- **Which month opens.** `PeriodProvider` follows the data until the user picks something: the current month when it has data (or nothing has data at all), otherwise the latest month with data. A backup export is usually older than today, so Home opens on its newest month instead of an empty current one. The current month is always in the month and calendar sheets. Home shows a blank screen (`homeLoading`) until the months have been read, so it never flashes the wrong month.
- **Empty states.** Home with no data anywhere keeps "Nothing here yet." If other months have data, an empty month reads "No payments in <month>." and points to the month picker. Transactions and Insights say the same for an empty month.
- **Transactions follows the month** picked on Home (there is no month control on that screen). Direction, category and search are SQL filters (`LIKE` on name, note and category name, ASCII case-insensitive). "See all N" on Home counts payments (money out); the list also shows money in, so its row count is larger.
- **What counts as a payment.** `flow = 'spend'`, retracted rows excluded, self-transfers included. Credits (refunds, reversals) are money in on the list and offset spend in the totals.
- **"What were these for?"** `needsNoteCount` counts outgoing SMS payments in the Misc category with no note of any kind (a user note, a cleared note and a clean reference all count as answered), not snoozed, and occurring after `meta.first_import_at`. With no `first_import_at` nothing is counted. A backup import therefore shows no card. Rows in the list show the yellow "Add a note" state by the same rule (out, no note, Misc, not hand-added); the old rule (any row with a null note) would have marked every imported row. `needsNoteList` feeds the Add note sheet when it opens without an id. `cashOutPrompts` is the cash-out half: kind `cash_out`, outgoing, no user note and no manual category, `occurred_at >= first_import_at`, not snoozed. `monthSummary.needNote` is the sum of both, so the card is one card with both kinds counted.
- **Transaction detail.** The time shows "about" when `occurred_at_source = 'received'`, and the year when it is not the current one. "Balance after" is hidden when there is none. The line under the amount says if the payment was reversed or reverses another. Message text is never stored, so the "Original message" toggle opens a line saying so (`originalMessage` is null until the inbox scan can read it back). A route id that is not a stored transaction shows `detailNotFound`. Hand-added expenses are stored rows, so they open like any other. Save changes writes the note and category (section 4); the "always tag" toggle is hidden for hand-added rows.
- **Counterparty fallback.** A message with no name or merchant shows `Cash out`, `Interest`, `Refund`, `Reversal` or `MoMo payment` (`fallbackCounterparty`).
- **Placeholder categories.** Until the categoriser lands, imported payments are Cash (cash-out) or Misc and money in is Income, so the legends are mostly Other. Nothing in the read side changes when it lands.
- **Times** are UTC and ranges are `[start, end)`; the daily chart, the biggest day and the day view use the same UTC dates.

Manual expenses (written by `addManualExpense`) are `transactions` rows with `origin = 'manual'`, `momo_txn_id` NULL, `occurred_at_source = 'user'`, `flow = 'spend'` and no auto category. The "what was it for" title goes in `counterparty_name` and the chosen category in `transaction_annotations.category_id`.

### How budgets will plug in

Budgets arrive as migration `0002` (`budgets` and `budget_alerts`, sketched in `data-model.md` and applied in `src/data/__tests__/budgets.test.ts`). `transactions` does not change. Spend against a limit is `SUM(pesewas) FROM ledger_lines WHERE bucket = 'spend' AND category_id = ? AND at >= ? AND at < ?`. The month's time range uses `transactions_time`; the category filter is applied after, because the effective category is a join result and `transactions_cat_time` cannot serve it. Category ids are never reused. `deleteCategory` must add the budget count to its confirmation, because the cascade removes those rows.

Still not built: the rest of `src/ledger` (reparse). Writes live in `src/ledger` (there is no `src/data/repos`); `deleteCategory` is built and `categoryImpact` supplies the budget count for its confirmation.

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
  - on top of that these assert sample content: `home-screen` (`homeSpentAmount`, `dailyChart`, `needsNoteCard`), `add-note-category` (`needsNoteCard`; the sheet also needs a pending payment, and Save stays disabled until the note or category changes), `home-filter` (`transactionRow-t1`, `-t2`), `transactions-filters` (`-t1`, `-t4`, `addNoteLink-t5`), `transactions-search` (`-t1` to `-t3`), `transaction-detail` (`transactionRow-t3`, the original message text), `month-picker` (`monthOption-2026-08`) and `insights-calendar` (`calendarDay-2026-10-19`, `-28`, `calendarMonth-2026-08`, "Monday 19 Oct").
  - Changed by the write side (piece 4b): `unread-messages` asserts `unreadMessage-u1`, `unreadAdd-u2` and `unreadIgnore-*` from the old sample messages. The list is now empty without inbox rows, so it fails at `unreadMessage-u1` (the empty state is `unreadEmpty`). `edit-category` taps `suggestion-shawarma`, which now exists only after that seed word is removed. `transactions-filters` and `home-screen` open `addNoteSheet`, which now shows the real payment, or `addNoteDoneBtn` when none is pending. `transaction-detail` needs a stored row, and `detailSaveBtn` now writes. `new-category-sheet` still follows its steps, but `createCategoryBtn` is disabled until a name is typed and a duplicate name shows `newCategoryError`. `settings-lock-toggle` is unaffected.
  - New test ids: `addExpenseLinkedNote`, `addExpenseError`, `addNoteDoneBtn`, `addNoteError`, `cashOutError`, `cashOutLink-<id>`, `detailError`, `editCategoryError`, `newCategoryError`, `newCategoryWordInput`, `newCategoryWord-<word>`, `familyNameError`, `friendNameError`, `unreadError`.

  A fixture should also set `meta.first_import_at` before the sample payments so the needs-a-note card appears. New test ids: `homeLoading`, `detailLoading`, `detailNotFound`, `insightsMonthEmpty`.
- **`INTERNET` is still in the manifest.** This piece did not touch it (a later release-build task strips it, and a dev build needs it for Metro). Until that lands, Privacy's "does not ask for internet access" is false for every build, and the privacy argument for `READ_SMS` rests on the code, not the manifest.
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
