# Data model

The SQLite schema in `src/data/migrations/0001_init.ts` is the source of truth. This file explains its shape and the reasons. It supersedes section 6 of `system-design.md`. When the two disagree, this file and the migration win.

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
| User-owned | `transaction_annotations`, `message_dismissals`, `categories`, `keywords`, `name_lists`, `recipient_rules`, `transactions` where `origin = 'manual'`, user rows of `reversal_links`, `meta` | The user, through the app. |

Tables:

- `meta`. Key-value app state (`parser_version`, `seed_version`, `first_import_done`, `first_import_at`, `last_import_at`, `onboarding_choice` = `'not_now'`, owner number, lock flag). Typed keys are in `src/data/meta.ts`.
- `categories`, `keywords`, `name_lists`, `recipient_rules`. Categoriser config. Five categories (`family`, `friends`, `income`, `cash`, `misc`) are inserted by the migration and protected by triggers.
- `sms_messages`. One row per message identity, never deleted. `source = 'inbox'` rows are identified by `(android_sms_id, received_at)`, and a message that leaves the inbox gets `gone_at`. `source = 'backup'` rows (backup import) have a NULL `android_sms_id` and a `backup_key` of `<received_at>:<momo_txn_id>:<template_name>`, unique among backup rows. CHECKs tie each column to its source, and backup rows are always `parsed` and never `gone`.
- `sms_fragments`. What one message said about its transaction.
- `transactions`. Both SMS and manual money rows. `flow` (`spend`, `income`, `credit`) is the accounting meaning. `kind` is open text.
- `transaction_annotations`. The user's category tag, note and "ask me later" snooze, one row per transaction.
- `reversal_links`. One row per credit, pointing at its original (or at nothing, when the user says there is none).
- `message_dismissals`. "Ignore" on "Messages we couldn't read".

Views:

- `transaction_category`. The effective category of every transaction.
- `ledger_lines`. The one accounting rule (below).
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
| `monthlyFlows(db, endMonthId, count)` | Money out and in for `count` months ending at a month, zero for empty ones |
| `daySpend(db, iso)` | A day's total and category split |
| `weekdayAverage(db, weekday)` | An average day of that weekday (0 is Sunday): spend on it divided by how many of that weekday fall between the first and last day with spend |
| `listCategories(db)` | The categories table in display order with UI ids |
| `categoryKeywords(db, id)` / `keywordCounts(db)` | A category's words (the user's first) / the word count per category |
| `categoryImpact(db, id)` | Whether a category can be deleted and the transactions, words, rules and budgets that deleting it touches |
| `nameLists(db)` | Family and friend names |
| `unreadMessages(db)` | Rows of `unread_messages` (inbox only; no text) |

Writes are in `src/ledger`: `addManualExpense`, `editTransaction`, `createCategory`, `addKeyword`, `removeKeyword`, `deleteCategory`, `addName`, `removeName`, `dismissMessage`. Each is one `ledgerQueue` task and one exclusive transaction, and each that changes the categoriser's inputs ends with `recategoriseIn`.

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

## Budgeting as migration 0002

Additive. `src/data/__tests__/budgets.test.ts` applies this on top of 0001.

```sql
CREATE TABLE budgets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER REFERENCES categories(id) ON DELETE CASCADE,  -- NULL = overall limit
  effective_from TEXT NOT NULL CHECK (effective_from GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  limit_pesewas  INTEGER NOT NULL CHECK (limit_pesewas >= 0),          -- applies until a later row replaces it
  rollover       INTEGER NOT NULL DEFAULT 0 CHECK (rollover IN (0,1)),
  created_at     INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX budgets_category_from ON budgets(category_id, effective_from) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX budgets_overall_from  ON budgets(effective_from) WHERE category_id IS NULL;
CREATE TABLE budget_alerts (
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  month TEXT NOT NULL, threshold_pct INTEGER NOT NULL, fired_at INTEGER NOT NULL,
  PRIMARY KEY (budget_id, month, threshold_pct)
) STRICT;
```

Spend against a limit is `SELECT SUM(pesewas) FROM ledger_lines WHERE bucket = 'spend' AND category_id = ? AND at >= :start AND at < :end`. Rollover is the same sum over earlier months. `deleteCategory()` shows the budget count in its confirmation because the cascade removes those rows.

## Riskiest assumptions

1. **`momo_txn_id` is unique per wallet and shared by every message of one transaction.** The whole merge rests on it. If MTN reuses an id, or a dual-SIM phone has two wallets with colliding ids, two payments merge. `has_conflict` catches it only when amount or kind differ.
2. **`(android_sms_id, received_at)` identifies an inbox message.** Backup-import messages (system-design 7.9) have no Android id, so they use `backup_key`. The txn id alone is shared by all messages of a payment and the time alone can collide, so the key joins both plus the matching template. `source_on_phone` counts inbox fragments only, and `unread_messages` lists inbox rows only. A backup restore that rewrites dates creates a duplicate message row. That is harmless, since it folds into the same transaction.
3. **The bundled SQLite supports STRICT.** Verified in node:sqlite 3.51, not yet on a device.
4. **Three flows cover the accounting, and a credit belongs to its original's month and category.** A reversal restates a past month. A flow outside the three needs a table rebuild, because `flow` has a CHECK.
5. **Manual expenses do not overlap SMS spend.** Cash spent from a cash-out is counted twice, once as the cash-out and once as the manual expense. Only "Add by hand" is de-duplicated, through `source_message_id`. A "paid from this cash-out" feature would add a table and change `ledger_lines`.

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
