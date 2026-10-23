# Data model

The SQLite schema in `src/data/migrations` (`0001_init.ts`, `0002_cash_allocations.ts`, `0003_budgets.ts`) is the source of truth. This file explains its shape and the reasons. It supersedes section 6 of `system-design.md`. When the two disagree, this file and the migration win.

## Conventions

- Money is INTEGER pesewas. Times are INTEGER epoch milliseconds UTC. Booleans are INTEGER 0 or 1.
- Every table is STRICT, so a REAL such as 10.5 cannot be stored in a money column. STRICT needs SQLite 3.37; expo-sqlite 58 bundles 3.53.
- CHECK constraints guard closed sets only. Sets that grow with the parser (`kind`, ignore reason, `auto_category_source`) are TypeScript unions, because SQLite cannot alter a CHECK without rebuilding the table.
- Connection pragmas are not part of the migration (they cannot run inside its transaction). Every connection sets `foreign_keys = ON`, `journal_mode = WAL` and `busy_timeout = 5000`, and writers use `BEGIN IMMEDIATE`.
- Triggers back up the foreign keys that matter, because some connections run with `foreign_keys` OFF.

## Shape: who owns which table

Data is split by writer so one writer cannot clobber another.

| Class | Tables | Written by |
|---|---|---|
| Observed | `sms_messages`, `sms_fragments` | The parser only. No message text is stored. |
| Derived | `transactions` where `origin = 'sms'`, auto rows of `reversal_links`, the `auto_category_*` columns | The ledger. Each SMS transaction is `mergeAll(fragments)` plus the categoriser. |
| User-owned | `transaction_annotations`, `cash_allocations`, `budget_plans`, `budget_limits`, `message_dismissals`, `categories`, `keywords`, `name_lists`, `recipient_rules`, `transactions` where `origin = 'manual'`, user rows of `reversal_links`, `meta` | The user, through the app. |

Tables:

- `meta`. Key-value app state (`parser_version`, `seed_version`, `first_import_done`, `first_import_at`, `last_import_at`, `onboarding_choice` = `'not_now'`, owner number, `app_lock_enabled` = `'1'` or `'0'`, `wrapped_track` = index of the last Wrapped music track started, `wrapped_muted` = `'1'` or `'0'`). Typed keys are in `src/data/meta.ts`.
- `categories`, `keywords`, `name_lists`, `recipient_rules`. Categoriser config. Five categories (`family`, `friends`, `income`, `cash`, `misc`) are inserted by the migration and protected by triggers.
- `sms_messages`. One row per message identity, never deleted. `source = 'inbox'` rows are identified by `(android_sms_id, received_at)`, and a message that leaves the inbox gets `gone_at`. `source = 'backup'` rows (backup import) have a NULL `android_sms_id` and a `backup_key` of `<received_at>:<momo_txn_id>:<template_name>`, unique among backup rows. CHECKs tie each column to its source, and backup rows are always `parsed` and never `gone`.
- `sms_fragments`. What one message said about its transaction.
- `transactions`. Both SMS and manual money rows. `flow` (`spend`, `income`, `credit`) is the accounting meaning. `kind` is open text.
- `transaction_annotations`. The user's category tag, note and "ask me later" snooze, one row per transaction.
- `reversal_links`. One row per credit, pointing at its original (or at nothing, when the user says there is none).
- `cash_allocations`. Where a cash-out's money went: one row per category it was spent on (migration 0002, below).
- `budget_plans`, `budget_limits`. A span of days with a total, and optional per-category limits (migration 0003, below).
- `message_dismissals`. "Ignore" on "Messages we couldn't read".

Views:

- `transaction_category`. The effective category of every transaction.
- `ledger_lines`. The one accounting rule (below). Recreated by 0002 to split cash-outs; no other view reads it.
- `transaction_list`. What list, detail and search read: hides retracted rows, resolves note and category.
- `unread_messages`. Unparsed or errored messages still on the phone, not dismissed, not typed in by hand.

## Category: tag, auto, Misc

`transactions.auto_category_id` and `auto_category_source` are the categoriser's output. Recategorise overwrites them without reading anything else. The user's tag lives only in `transaction_annotations.category_id`. The effective category is the first of tag, auto and Misc that still exists in `categories`. Each is looked up by join, so an id pointing at a deleted row (possible with foreign keys off) falls through to Misc instead of surviving as a dangling id. Manual transactions have no auto category (both columns NULL); their category is an annotation.

`transaction_list.category_source` is `manual` when a live tag wins, else `auto_category_source`.

Deleting a category: `auto_category_id` is `RESTRICT`, so `deleteCategory()` recategorises first and a raw DELETE fails loudly. Annotations are `SET NULL`, so the user's note survives. Keywords and rules cascade. Category ids use AUTOINCREMENT and are never reused, which lets budgets, filters and router params hold them.

## The accounting rule: `ledger_lines`

Every total is one SUM over `ledger_lines` for `[at >= start AND at < end]`, optionally filtered by `category_id`. Columns: `transaction_id`, `at`, `category_id`, `bucket` (`spend` or `income`), `part` (`amount`, `charge` or `credit`), `pesewas`.

| Total | Query |
|---|---|
| Spend | `SUM(pesewas) WHERE bucket = 'spend'` (amounts plus charges minus refunds) |
| Income | `SUM(pesewas) WHERE bucket = 'income'` |
| Fees and tax | `SUM(pesewas) WHERE part = 'charge'` (a subset of spend) |

Rules built into the view:

- A spend row contributes its amount, plus one `charge` line for fee and tax when they are non-zero.
- Credits are never income. A credit linked to a live original offsets the original's month and category. Per original, the offset is `MIN(original amount, SUM(its credits))`, so an over-refund cannot make a category negative. Fees the reversal did not return stay counted. This line carries the original's `transaction_id`.
- A credit with no live original (unlinked, linked to a retracted row, or marked "no original" by the user) offsets its own month and category by its full amount.
- Retracted rows contribute nothing.
- A cash-out with allocations contributes its remainder (amount minus allocated, clamped at 0) in its effective category, then one line per allocation in the allocation's category, all at the cash-out's `occurred_at` (next section). With no allocations nothing changes.

Example: 1000 spent with a 60 fee, then refunds of 300 and 200. Spend in the original's month is 1000 + 60 - 500 = 560.

Query plan: the time range is pushed into every branch of the view and uses `transactions_time`. The category predicate is not, because the effective category is a join result, so `transactions_cat_time (auto_category_id, occurred_at)` does not serve budget or category-spend queries. The cost is bounded by the rows in the month (a few hundred), not by the table. The index still serves recategorise and the RESTRICT check on category delete.

## Read queries

`src/data/queries` holds every read the screens use: plain SQL over `ledger_lines` and `transaction_list` on the `Db` interface, so they run in Node tests (`src/data/__tests__/queries.test.ts`, and `realFileQueries.test.ts` on a real export when present). Ranges are `[start, end)` in UTC epoch ms; money is integer pesewas; category ids come back as UI ids (`system_key`, with `misc` as `other`, or the row id as a string).

| Function | Returns |
|---|---|
| `monthsWithData(db)` | Every month with a ledger line, oldest first, with spent and money in |
| `monthFacts(db, monthId, todayIso, now)` / `monthSummary` | The inputs of `MonthSummary` (spent, money in, payments, needs-a-note count, spend per day, the previous month's spend over the same stretch) and the `MonthSummary` built from them by `buildMonthSummary` |
| `categorySpend(db, range)` | Net spend per effective category for a month or a day, largest first, categories netting to zero or less left out |
| `listTransactions(db, filters, limit?)` | Rows newest first as `{ iso, row: TransactionRow }`; filters: range, direction, category, search over counterparty, note and category name |
| `recentPayments(db, range, limit)` | The latest outgoing payments |
| `paymentCount(db, range)` | Outgoing, non-retracted transactions in the range |
| `transactionDetail(db, id, today)` | `TransactionDetail` (kind label, time label and approximate flag, balance after, note and its source, reversed or reverses) or null |
| `needsNoteCount` / `needsNoteList(db, range, now)` | Outgoing SMS payments in Misc with no note and no live snooze, after `meta.first_import_at` (nothing when it is unset) |
| `cashOutPrompts(db, range, now)` | Cash-outs with no user note, no manual category and no allocation, at or after `meta.first_import_at`, not snoozed (`prompt_snoozed_until` null or `<= now`); nothing when it is unset |
| `cashOutBreakdown(db, id)` | A live cash-out's amount, date, name, allocations (newest spending day first), allocated and left; null for anything that is not a live cash-out |
| `cashOutLefts(db, range)` | Allocated and left for every live cash-out in the range, for the Transactions rows |
| `openCashOut(db, now)` | The newest cash-out of the last 30 days with something left, for the hint on Add expense |
| `monthlyFlows(db, endMonthId, count)` | Money out and in for `count` months ending at a month, zero for empty ones |
| `yearsWithData(db)` | Money out and in per year that has a ledger line, oldest first |
| `yearSummary(db, year)` | A year's twelve months (`monthlyFlows` ending in December), payment count and the year before's spend, built into a `YearSummary` |
| `allTimeSummary(db)` | Totals since the first payment, first and last month, a total per year, the busiest year and month, built into an `AllTimeSummary`. A year or all time is the same sums over a wider range: `categorySpend` takes `yearRange(year)` or `ALL_TIME` |
| `topCounterparties(db, range, n, by)` | The `n` people or places paid most, by net spend or by payment count. Money out only, names only: grouped by lower-cased name, so a merchant code or number never stands in for one; payments to yourself, typed-in expenses and unnamed rows are left out |
| `biggestPayment(db, range)` | The largest single payment by net amount (refunds off, fees not added), its name (null when the row has none) and UTC date; the earliest wins a tie |
| `weekdayTotals(db, range)` | Net spend per UTC weekday, Sunday first, seven integers |
| `activeDays(db, range)` | Days with net spending, and the days from the first to the last of them, both included |
| `wrappedFacts(db, scope)` | The `WrappedFacts` for a year or all time: the totals come from `yearSummary` or `allTimeSummary` so they equal Insights, plus the queries above and `categorySpend`. `buildWrapped` turns them into slides |
| `daySpend(db, iso)` | A day's total and category split |
| `weekdayAverage(db, weekday)` | An average day of that weekday (0 is Sunday): spend on it divided by how many of that weekday fall between the first and last day with spend |
| `listPlans(db)` | Every budget plan, latest first, each with its net spend over its days (one correlated SUM over `ledger_lines`) |
| `budgetPlan(db, id)` / `planLimits(db, id)` | One plan with its spend / its limits as UI category ids, biggest first |
| `budgetView(db, id, todayIso)` | A plan measured: the total, each limited category, "everything else", the pace and a one-line headline, built by `buildBudgetView` from `categorySpend` over the plan's range and the plan's spend |
| `budgetHistory(db, startDay, days)` | Net spend per category over the same number of days right before `startDay`, for `suggestPlan` |
| `listCategories(db)` | The categories table in display order with UI ids |
| `categoryKeywords(db, id)` / `keywordCounts(db)` | A category's words (the user's first) / the word count per category |
| `categoryImpact(db, id)` | Whether a category can be deleted and the transactions, words, rules and budgets that deleting it touches |
| `nameLists(db)` | Family and friend names |
| `unreadMessages(db)` | Rows of `unread_messages` (inbox only; no text) |

Writes are in `src/ledger`: `addManualExpense`, `editTransaction`, `createCategory`, `addKeyword`, `removeKeyword`, `deleteCategory`, `addName`, `removeName`, `dismissMessage`, `addAllocation`, `updateAllocation`, `deleteAllocation`, `createPlan`, `updatePlan`, `setLimit`, `removeLimit`, `replaceLimits`, `deletePlan`. Each is one `ledgerQueue` task and one exclusive transaction, and each that changes the categoriser's inputs ends with `recategoriseIn`.

## Cash-out allocations (migration 0002)

A cash-out is cash taken from a MoMo agent. MoMo says nothing about what happens next, so the user spends it on several things over several days and records them afterwards. Each entry is an allocation: an amount, a category, an optional note and the date it was spent.

```sql
CREATE TABLE cash_allocations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_out_txn_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount_pesewas  INTEGER NOT NULL CHECK (amount_pesewas > 0),
  note            TEXT CHECK (note IS NULL OR (note <> '' AND note = trim(note))),
  spent_on        INTEGER NOT NULL,   -- epoch ms UTC, informational
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
) STRICT;
CREATE INDEX cash_allocations_cash_out ON cash_allocations(cash_out_txn_id);
```

Rules, all enforced by triggers because `foreign_keys` can be OFF:

- The target must be an SMS transaction with `kind = 'cash_out'` and `flow = 'spend'` (insert, and update of `cash_out_txn_id`).
- The sum of a cash-out's allocations must not exceed its `amount_pesewas` (insert, and update of amount or target). The ledger functions check first and return a message; the trigger is the backstop.
- `ledger_lines` is the only place the money is counted. An allocation never adds spend. It moves part of the cash-out's own amount from the cash-out's effective category (the manual tag, else Cash) to the allocation's category. Both lines sit at the cash-out's `occurred_at`, so month, day and year totals do not change and `spent_on` is never read by a total. A category's spend for a month can change; the month's total cannot.
- The remainder line is left out when it is 0 and something is allocated, so no zero line appears. It is clamped at 0, so a cash-out whose amount later shrank below its allocations cannot produce a negative line (the extra allocation money then counts on top).
- The fee and tax charge line of a cash-out is unchanged and stays in the cash-out's category.
- A manual answer ("What was this for?", a category or note) keeps working: with no allocations the whole amount goes to the answered category as before; with allocations the remainder does.
- A cash-out stays in the needs-an-answer list until it has a note, a manual category or at least one allocation. A partly allocated one is not nagged. The snooze and the first-import cut-off still apply.
- `spent_on` is a UTC midnight chosen by the user. The ledger accepts any day from the cash-out's day to today, never later.
- `category_id` is RESTRICT. `deleteCategory` moves allocations to Misc, as it does annotations, and `categoryImpact().allocations` counts them for the confirmation.
- Deleting an allocation, or editing one, takes effect on every total at once, since the view is recomputed on read.

Dependents of `ledger_lines` (all read it and follow with no change): `monthsWithData`, `monthFacts` / `monthSummary`, `monthlyFlows`, `daySpend`, `weekdayAverage`, `categorySpend`, `yearSummary`, `allTimeSummary`, `yearsWithData`, the Wrapped queries (`topCounterparties`, `biggestPayment`, `weekdayTotals`, `activeDays`, which group by `transaction_id` and so see the cash-out as one payment) and the import summary. No other view depends on it.

## How the hard cases work

- **Re-parse after a parser change.** For each message still on the phone that is stale, unparsed, ignored or errored, replace its fragment, then re-fold every affected `momo_txn_id` (old and new). A message that is gone keeps its last fragment. A transaction left with no fragments gets `retracted_at` and is not deleted, so notes and links stay attached.
- **Reversals and refunds.** An original may have several credits. A user link, or a user's "no original", is never touched by the auto-linker. A trigger limits links to credit-to-spend.
- **Duplicate messages for one transaction.** N fragments share a `momo_txn_id` and fold with `mergeAll`. The result does not depend on arrival order.
- **SMS deleted from the phone.** The scan sets `gone_at`. The fragment and the transaction stay. "Original message" availability is derived (`source_on_phone`).
- **Android reusing SMS ids.** A partial unique index allows one live row per Android id. The scan marks the old row gone, then inserts the new one. Identity columns are immutable (trigger).
- **Notes.** `transaction_annotations.note` NULL means show the SMS reference. `''` means the user cleared it and the view shows NULL. Any other note equals its own trim.
- **Concurrent writers.** Writes are upserts on natural keys, so overlapping ingests converge. The user and the ledger write different tables. `BEGIN IMMEDIATE` with WAL and `busy_timeout` also holds across connections.

## Seeds

The migration inserts the five protected categories (Cash is `#444444`). `seedDatabase` inserts the other UI categories from `src/domain/category/seed.ts`, with `system_key` equal to the UI id; UI `other` is the existing Misc row. Each seed step lists only the rows version N introduced, and runs once when `meta.seed_version` is below N. A row the user deleted therefore never comes back, with no tombstone table. Every row stores the `seed_version` that introduced it.

## Budget plans (migration 0003)

A plan is a span of days the user means to stay inside a total for, with optional limits per category. It replaces the earlier sketch, which assumed monthly limits that carried forward from an `effective_from` month: people budget for a week, a fortnight or until payday, not only a calendar month, so the span is the unit.

```sql
CREATE TABLE budget_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT CHECK (name IS NULL OR (name <> '' AND name = trim(name))),
  start_day TEXT NOT NULL CHECK (start_day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  end_day   TEXT NOT NULL CHECK (end_day   GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  total_pesewas INTEGER NOT NULL CHECK (total_pesewas > 0),
  daily_pesewas INTEGER CHECK (daily_pesewas IS NULL OR daily_pesewas > 0),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  CHECK (end_day >= start_day),
  CHECK (daily_pesewas IS NULL OR total_pesewas = daily_pesewas * (CAST(julianday(end_day) - julianday(start_day) AS INTEGER) + 1))
) STRICT;
CREATE TABLE budget_limits (
  plan_id     INTEGER NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id)   ON DELETE CASCADE,
  limit_pesewas INTEGER NOT NULL CHECK (limit_pesewas > 0),
  PRIMARY KEY (plan_id, category_id)
) STRICT;
```

- `start_day` and `end_day` are UTC dates, both inclusive, so a one-day plan has the same day twice. A plan's range is `[start_day 00:00, end_day + 1 day 00:00)` in epoch ms, which is the `[start, end)` every query takes. `planRange` (domain) and `PLAN_SQL` (`strftime('%s', ...)`) are the two statements of the rule; `budgets.test.ts` checks they agree to the millisecond at both edges.
- **Stated per day.** `daily_pesewas` is set when the user said "X a day". The total is then `daily * days`, held by a CHECK, so the ledger recomputes the total whenever the days change and the two cannot disagree. A plan without it is stated as a total, and its pace is the total over the days (rounded down). Either way `paceOf` returns `perDay` and `cushion`.
- Nothing about spending is stored. Spend against a plan or a limit is `SUM(pesewas) FROM ledger_lines WHERE bucket = 'spend' AND at >= :start AND at < :end` (plus `AND category_id = ?` for a limit). A refund, a re-tag, a cash-out allocation or a new import therefore moves a plan with no budget write. A plan may start in the past and counts what was already spent in its days.
- Triggers, because `foreign_keys` can be OFF and a CHECK cannot read another table: two plans cannot share a day (insert, and update of either day); limits cannot add up to more than the total (insert, update of amount or plan, and update of the plan's total); income takes no limit.
- The ledger functions check first with the same pure rules (`planProblem`, `limitProblem`, `limitsProblem`) and return a message; the triggers are the backstop. `setLimit` updates then inserts instead of upserting, because SQLite runs the insert trigger before it resolves a conflict, which would count the old limit twice.
- Limits need not add up to the total. What they leave is "Everything else": its allowance is `total - sum(limits)` and its spend is the plan's spend outside the limited categories. A limit never changes how a transaction is categorised.
- Deleting a category deletes its limits in `deleteCategory` (explicitly, because the cascade does not run with foreign keys OFF) and `categoryImpact().budgets` counts them for the confirmation. Deleting a plan deletes its limits and leaves every transaction alone.
- **Safe or behind.** By the end of day N the plan allows `round(total * N / days)`; `cushion` is that minus net spend so far, and a negative cushion is "behind" (`standingOf`, `src/domain/budget/standing.ts`). `todayOf` compares today's net spend with `perDay`. `budgetView` reads today's spend with one more SUM over `ledger_lines` for today's UTC day. Neither exists before the plan starts or after it ends.
- Tone: a line is `watch` from 80% of its limit and `over` past 100%. A net refund reads as nothing spent. Pace, the safe amount per remaining day (today included) and the headline sentence are pure functions in `src/domain/budget`.
- Not built: rollover, recurring plans, alerts. Alerts would need a notification permission and module; the status is shown in the app instead.

## Riskiest assumptions

1. **`momo_txn_id` is unique per wallet and shared by every message of one transaction.** The whole merge rests on it. If MTN reuses an id, or a dual-SIM phone has two wallets with colliding ids, two payments merge. `has_conflict` catches it only when amount or kind differ.
2. **`(android_sms_id, received_at)` identifies an inbox message.** Backup-import messages (system-design 7.9) have no Android id, so they use `backup_key`. The txn id alone is shared by all messages of a payment and the time alone can collide, so the key joins both plus the matching template. `source_on_phone` counts inbox fragments only, and `unread_messages` lists inbox rows only. A backup restore that rewrites dates creates a duplicate message row. That is harmless, since it folds into the same transaction.
3. **The bundled SQLite supports STRICT.** Verified in node:sqlite 3.51, not yet on a device.
4. **Three flows cover the accounting, and a credit belongs to its original's month and category.** A reversal restates a past month. A flow outside the three needs a table rebuild, because `flow` has a CHECK.
5. **A manual expense does not know about a cash-out.** Cash spent from a cash-out is recorded as allocations, which redistribute the cash-out and add no spend. If the user also adds the same cash spending through Add expense, it is counted twice. Add expense shows a hint when a cash-out from the last 30 days has something left. Only "Add by hand" is de-duplicated, through `source_message_id`.

## Arena record

Three candidate schemas were produced independently and compared. Candidate 2 was the base. Its design, verification list and rejected alternatives are the substance of the sections above.

**Grafts onto candidate 2**

- One accounting view, `ledger_lines`, extending candidate 2's `spend_lines`: spend, income and charges are each one SUM over it. Source: candidate 1's and candidate 3's single signed-lines views.
- Refund cap `MIN(original amount, SUM(credits))` per original, in the view. Source: candidate 3.
- `transactions.category_id` split (source: candidate 3) into `auto_category_id` and `auto_category_source`, with the manual tag only in `transaction_annotations`. The view resolves the effective category. This makes recategorise a blind overwrite.
- Tighter checks: `sms_messages` reason present exactly when status is `ignored` or `error`; `note = ''` for a cleared SMS reference.
- Candidate 2's triggers kept, because `foreign_keys` can be OFF.
- Candidate 2's "rows introduced in seed version N" seed rule kept.

**Rejected**

- Candidate 1's `seed_applied` table. It records every seed item ever applied so a deleted word never returns. The version rule does the same without a table that grows with the seed and can drift from `categories`.
- Candidate 1's `manual_expenses` as a separate table. Every list, total and filter would pay for a UNION, and annotations would need a polymorphic key. One table with `origin` and CHECKs is simpler.
- Candidate 3's closed `kind` CHECK, and its CHECK tying `kind = 'manual'` to a NULL `momo_txn_id`. A new MTN message shape would need a table rebuild. Totals depend on `flow`, and `origin` already says where a row came from, so `kind` stays open text.
- Candidate 3's use of `kind` to separate manual rows from SMS rows in the totals. The accounting reads `flow` only.
- The earlier draft's `manual:<uuid>` in `momo_txn_id`. It puts a fake value in a column with domain meaning. Manual rows now have `momo_txn_id` NULL, enforced by CHECK.

**Known gap.** If a parser fix changes a transaction's `momo_txn_id`, the old row is retracted and the new one starts without the old row's annotations and links. The re-parse step must move them explicitly. Nothing in the schema does it.
