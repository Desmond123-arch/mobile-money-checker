# Integration handoff

Read this before connecting the app to real data. It lists what is real, what is a stand-in, and where each stand-in plugs in. `docs/system-design.md` is the target architecture; this file is the gap between it and the code today. The change history is in [`CHANGELOG.md`](../CHANGELOG.md).

## 1. State in one paragraph

All 14 screens plus the month, calendar, category-filter and add-expense sheets are built and run on sample data. There is no SMS module, no SQLite, no ledger and no scan. `src/domain` is pure and tested; `src/features` and `src/ui` are UI only. Several screens look like they save but only change local React state.

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
| Settings lists | Fake. `src/features/settings/sample.ts` (word counts, family and friend names, unread messages) | `keywords`, name lists and the unparsed list from `seen_messages` |
| "Today" | Device clock via `useToday()` | Keep; sample data assumes Tue 20 Oct 2026 |
| Permission, importing | Screens only. Reachable at `/permission`, `/permission-denied`, `/importing` | Wire to the `momo-sms` module and the first-run flow |

Rules the code already follows: money is integer pesewas, dates are ISO `YYYY-MM-DD` in UTC (Ghana is UTC+0), the domain imports no React, Expo or SQLite (ESLint enforces it).

## 3. State that must move into storage

These hold user input in memory only. They reset on reload.

| Where | What it holds | Becomes |
|---|---|---|
| `ExpensesProvider` (`src/features/expenses`) | Expenses added by hand; also merged into Home totals, categories and recent, and into Transactions | A manual-transaction table or flag, written through the ledger |
| `PeriodProvider` (`src/features/period`) | Selected month or day | UI state only. Keep as context or router params |
| `TransactionFilterProvider` (`src/features/transactions/filterContext.tsx`) | Selected category filter | UI state only |
| `NameList` (settings) | Family and friend names | `name_lists` |
| `EditCategoryScreen` | Words added and removed | `keywords` |
| `NewCategorySheet` | New category | `categories` |
| `UnreadMessagesScreen` | Ignored message ids | Ignore rule plus `seen_messages` status |
| `TransactionDetailScreen`, `AddNoteSheet`, `CashOutSheet` | Note, category, "always tag this recipient" | `overrides` and `recipient_rules` |
| `SettingsScreen` | Lock the app toggle | Real app lock (not built) |

## 4. Buttons that look like they save but do not

`Save changes` (`detailSaveBtn`), `Save note` (`addNoteSaveBtn`), `Save` (`cashOutSaveBtn`), `Create category` (`createCategoryBtn`), `Add by hand` (`unreadAdd-*`), `Copy text` only copies, `Delete this category` only closes. `Add expense` does keep its result, but only in memory.

## 5. Not built yet (from `docs/system-design.md`)

`modules/momo-sms` (Kotlin module), `src/data` (SQLite, migrations, repos), `src/ledger` (ingest, project, recategorise), `src/scan`, the parser templates, reversal linking. The folders do not exist.

## 6. Things that will bite

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
