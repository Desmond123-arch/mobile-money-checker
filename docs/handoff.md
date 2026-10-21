# Integration handoff

Read this before connecting the app to real data. It lists what is real, what is a stand-in, and where each stand-in plugs in. `docs/system-design.md` is the target architecture; this file is the gap between it and the code today. The change history is in [`CHANGELOG.md`](../CHANGELOG.md).

## 1. State in one paragraph

All 14 screens plus the month, calendar, category-filter and add-expense sheets are built. The backup import is real: `DbProvider` opens, migrates and seeds the database at startup, and importing an SMS Backup & Restore file parses it and writes real rows through `src/ledger`. Home, Transactions (list and detail), Insights and the month and calendar sheets read those rows through `src/data/queries` and TanStack Query, and every button that saves now writes to SQLite through `src/ledger` (hand-added expenses, notes, category tags, recipient rules, categories and their words, family and friends names, ignored messages; section 4). Live SMS reading is compiled and has run on the emulator, but not on a real phone (section 5, "Live SMS reading"). Nothing user-facing is a stand-in any more. "Lock the app" is real (section 5, "App lock"). `src/domain` is pure and tested; `src/features` and `src/ui` are UI only.

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
| Insights | Real. `monthlyFlows` (six months), `daySpend`, `weekdayAverage` (the "not happened yet" average), `yearSummary`, `yearsWithData` and `allTimeSummary` (the Year and All time scopes, which live beside the period in `PeriodProvider` as `scope` and never touch Home's month), hooks in `src/features/insights/useInsights.ts`. The weekday bar chart stays gone (design 8.5). Wrapped (design 8.12): `wrappedFacts` and `topCounterparties`, `biggestPayment`, `weekdayTotals`, `activeDays` in `src/data/queries/wrapped.ts` feed the pure `buildWrapped` (`src/domain/summary/wrapped.ts`); the screen is `src/app/wrapped.tsx` over `src/features/wrapped` | Keep |
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

Still not built: reparse. `modules/momo-sms` and `src/scan` exist but are unverified on a device (section 5).

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

**State: compiled and run on the Android emulator, not yet on a real phone.** The Kotlin compiled in an EAS dev build on 21 Oct 2026. On the emulator, with the inbox seeded through the emulator console (`adb emu sms send MobileMoney "<text>"`; direct `content insert` into the SMS provider is silently refused unless the app is the default SMS app, and the console cannot set the received time), these worked: the permission dialog, a scan of the seeded inbox, a new payment ingested about 1 s after arrival, two layouts of one payment merged into a single transaction, a GHS 10,000.00 amount, and an OTP (`<#>`) and a message from another sender staying out. The checks that need a real phone are still open in the manual list below (Android 13+ restricted settings from a sideloaded APK, id reuse after a restore, the hidden-sender toggle on MIUI, Tecno and Infinix phones). Do not call this verified until that list passes.

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

### App lock

Built, off by default, and not run on a device. It needs a **new dev build**, because `expo-local-authentication` is a native module and its config plugin adds `USE_BIOMETRIC` and `USE_FINGERPRINT` to the manifest. An old dev client throws "native module not found" the first time the lock is used; `lockAuth.ts` catches that and answers "failed", so the app stays locked rather than crashing. Build with `npm run build:dev` (or `build:dev:local`), then reinstall.

- **State machine.** `src/features/app/appLock.ts` is pure and unit tested. Phases are `unlocked`, `locked`, `authenticating` and `unavailable`. Cold start with the lock on starts `locked` and prompts at once. Leaving the app records the time; coming back after more than `LOCK_GRACE_MS` (30 000 ms) locks and prompts. Exactly 30 s does not lock. A clock that moved back locks. Cancel or failure stays `locked` with no automatic re-prompt; the Unlock button (`unlockBtn`) prompts again. No screen lock on the phone gives `unavailable`, which shows `lockUnavailableNote`.
- **Why a grace period.** The file picker and the permission dialogs send the app to the background for a moment. Without a grace period, importing a backup would relock the app halfway through.
- **Persistence.** `meta.app_lock_enabled` is `'1'` or `'0'`, absent means off (`getMeta` and `setMeta` in `src/data/meta.ts`).
- **Gate.** `LockGate` (`src/features/app/LockGate.tsx`) sits inside `DbProvider`, above `ScanProvider` and the stack. While locked it renders the lock screen (`lockScreen`) instead of its children, so no transaction screen is mounted behind it, and no scan runs. Every relock therefore drops navigation state: after unlocking the app returns to its start route. It hides the splash itself when it shows the lock screen, because `FirstRunGate` is not mounted then. With the lock off it renders its children unchanged, so the first-run flow is as before.
- **Adapter.** Only `src/features/app/lockAuth.ts` imports `expo-local-authentication`. The prompt says "Unlock MoMo Spend" and allows the device PIN, pattern or password when no biometric is enrolled. Tests use `src/features/app/__tests__/fakeLockAuth.ts`.
- **Settings.** The "Lock the app" switch (`settingsLockToggle`) asks for authentication before turning on and before turning off (`changeLock` in `appLockActions.ts`). With no screen lock on the phone, the row says "Set a screen lock in your phone's settings first" and the switch cannot be turned on. A lock that is already on can always be turned off, even when the phone lost its screen lock.
- **Privacy.** The lock gates the screen only. The database is not encrypted at rest, and the Settings text makes no claim that it is. Anyone who can read the app's files (a rooted phone, a backup of the device) can read the data.
- **Known edge.** If the lock is on and the phone loses its screen lock, the app stays on the lock screen with `lockUnavailableNote` until the user sets a screen lock again. It does not open without one.
- **Maestro.** `maestro/flows/app-lock.yml` covers only the no-screen-lock case, on an emulator with no screen lock. Maestro cannot satisfy a system biometric or PIN prompt, so the enabled path is manual.

Manual checklist on a real phone (new dev build, screen lock and fingerprint set):

1. Settings, More, switch "Lock the app" on. The system prompt appears; pass it. The switch turns on.
2. Switch it on, then cancel the prompt. The switch stays off.
3. Kill the app and reopen it. The lock screen shows and the prompt opens by itself. Pass it: the app opens on Home.
4. Open the app, press Home for 5 seconds, return. No lock screen.
5. Open the app, press Home for 60 seconds, return. The lock screen shows and prompts.
6. On the lock screen, cancel the prompt. The lock screen stays; tap Unlock and the prompt returns.
7. During step 4, also open "Import a backup file" and pick a file. The picker must not relock the app.
8. Switch the lock off. The prompt appears; pass it. Kill and reopen: no lock screen.
9. On a phone (or emulator) with no screen lock: the Lock the app row shows the note and the switch does nothing.
10. With the lock on, remove the phone's screen lock in system settings and reopen the app: the lock screen shows `lockUnavailableNote`. Set a screen lock, tap Unlock.

### Wrapped music

Built with five PLACEHOLDER tracks. The pieces:

- **Manifest.** `assets/audio/tracks.ts` is an array of `{ id, title, artist, license, sourceUrl, credit, asset }`; array order is playback order. `credit` is shown after the title when set. `assets/audio/README.md` explains how to swap a track (drop the file, edit one entry) and what to record per track (title, artist, licence, source URL, attribution text, date checked). Popular commercial songs cannot be used without a licence. `scripts/make-placeholder-music.mjs` regenerates the placeholders (`.m4a` with `ffmpeg`, else `.wav`).
- **Logic.** `src/domain/music/playlist.ts`: `nextIndex`, `startIndex` and `reducePlayer` over open, trackEnded, mute, unmute, background, foreground, close, interruption and error (status `idle`, `playing`, `paused`, `muted`, `unavailable`). `src/features/wrapped/musicDriver.ts` mirrors that state onto an adapter, `useWrappedMusic.ts` wires meta, AppState and cleanup.
- **Adapter.** `src/features/wrapped/audio.ts` is the only file that may import `expo-audio` (ESLint rule). It loads the module lazily inside try/catch, so Expo Go and a dev client built before `expo-audio` run silently with the mute button hidden. `audioFake.ts` is the test double. The audio mode is `doNotMix` (takes focus, other apps pause), silent switch respected, no background playback.
- **Meta keys.** `wrapped_track` (index of the last track started) and `wrapped_muted` (`'1'` or `'0'`).
- **Behaviour to know.** An engine error on any track turns music off for that visit (`unavailable`). After an audio-focus interruption, playback resumes when the app returns to the foreground or the user unmutes; it does not resume on its own when the other app stops.
- **Build.** `expo-audio` is a native module: build a new dev client (`npm run build:dev`) and a new production build. Its config plugin is not used, because it adds `RECORD_AUDIO`. The library manifest adds `MODIFY_AUDIO_SETTINGS`. `app.config.js` removes both (`blockedPermissions`) in every profile.

Manual device checklist (none of this has run on a device):

1. Opening Wrapped starts music, fading in over about a second.
2. A track ends and the next one starts. After the fifth, the first plays.
3. Close and re-open Wrapped: it starts with the track after the one that started last.
4. Mute stops the sound and the now-playing line; unmute starts it. Kill and relaunch the app: the mute choice is kept.
5. Home or switch apps: music pauses. Return to the open Wrapped: it resumes (not if muted).
6. Close Wrapped: music stops.
7. Start audio in another app while Wrapped plays: Wrapped pauses and nothing crashes.
8. Release APK: `npm run check:apk -- <apk> --expect-no-internet` lists no `RECORD_AUDIO` or other microphone permission.
9. Expo Go or an old dev client: Wrapped opens, there is no mute button, nothing crashes.

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
  - Changed by the write side (piece 4b): `unread-messages` asserts `unreadMessage-u1`, `unreadAdd-u2` and `unreadIgnore-*` from the old sample messages. The list is now empty without inbox rows, so it fails at `unreadMessage-u1` (the empty state is `unreadEmpty`). `edit-category` taps `suggestion-shawarma`, which now exists only after that seed word is removed. `transactions-filters` and `home-screen` open `addNoteSheet`, which now shows the real payment, or `addNoteDoneBtn` when none is pending. `transaction-detail` needs a stored row, and `detailSaveBtn` now writes. `new-category-sheet` still follows its steps, but `createCategoryBtn` is disabled until a name is typed and a duplicate name shows `newCategoryError`. `settings-lock-toggle` is replaced by `app-lock` (below).
  - New test ids: `addExpenseLinkedNote`, `addExpenseError`, `addNoteDoneBtn`, `addNoteError`, `cashOutError`, `cashOutLink-<id>`, `detailError`, `editCategoryError`, `newCategoryError`, `newCategoryWordInput`, `newCategoryWord-<word>`, `familyNameError`, `friendNameError`, `unreadError`.

  A fixture should also set `meta.first_import_at` before the sample payments so the needs-a-note card appears. New test ids: `homeLoading`, `detailLoading`, `detailNotFound`, `insightsMonthEmpty`.
- **`INTERNET` is stripped from release builds only.** `app.config.js` wraps the static `app.json` and adds `android.permission.INTERNET` to `android.blockedPermissions` (a `tools:node="remove"` entry in the manifest) when `EAS_BUILD_PROFILE` is `production` or `preview`, or when `APP_STRIP_INTERNET=1` is set. The `development` profile and local `expo start` keep `INTERNET` because the dev client loads JS from Metro. `expo-file-system` merges `INTERNET` in from its library manifest; the remove entry in the app manifest wins over it. `ACCESS_LOCAL_NETWORK` and `CHANGE_WIFI_MULTICAST_STATE` come from debug-only source sets of React Native and the dev launcher, so release variants never get them. `ACCESS_NETWORK_STATE` is not a network-use permission and is left alone.
- **Prove it on the APK, not the config.** `npm run check:apk -- path/to/app.apk --expect-no-internet` unzips the APK, decodes the binary `AndroidManifest.xml` and lists the `uses-permission` entries; it exits 1 if `INTERNET` is present. The dev APK lists `INTERNET`; a `production` or `preview` APK must not. Prebuild with `APP_STRIP_INTERNET=1` was checked in a temp copy (the removal entry is there), but the final APK from a production EAS build is still to be checked.
- **Privacy screen describes release builds.** It says "The app does not ask for internet access". That is true for `production` and `preview` builds only; a dev build still carries `INTERNET` for Metro.
- **Typed routes:** `.expo/types/router.d.ts` goes stale after adding routes and then `tsc` rejects new `router.push` paths locally. Delete the file; CI never has it.
- **Metro in CI mode** (`CI=1`) does not hot reload. Relaunch the app to pick up changes.
- **Dev client** built before `expo-clipboard` was added lacks the native module. Rebuild it (`npm run build:dev`). Copy text degrades to "Could not copy" instead of crashing.
- **Paper is out of date** for the Home totals and "+", Transactions Clear button, Transaction detail without fees, Add expense and the Insights calendar. Paper's weekly MCP limit was hit; update when it resets. `docs/design.md` section 8 is the source of truth meanwhile.
- **EAS:** project `momo-spend` under owner `desmends`, Android keystore is managed by EAS, versionCode is remote and auto-increments on production. Production builds an APK for now (change `build.production.android.buildType` to `app-bundle` for Play).
- **Git identity** for this repo is the Gmail address (`desmondopokumends2004@gmail.com`), set locally, so commits are credited to `Desmond123-arch`.

## 7. Checking your work

- `npm run check:categories -- <export.xml>` ingests an export in memory and prints the category split and redacted skeletons of unmatched references (counts only).
- `npm run check:apk -- <apk> --expect-no-internet` prints an APK's requested permissions and fails if `INTERNET` is among them.
- `npm run check` runs typecheck, lint, format and the Jest suite with the 95% domain coverage gate.
- `.claude/skills/verify-momo-spend` drives the app on an adb emulator through Expo Go and reads `testID`s as resource-ids. Prefer `tap-id` and `has-id`.
- Every element a flow or test touches gets a camelCase `testID`; naming is in `maestro/README.md`.
