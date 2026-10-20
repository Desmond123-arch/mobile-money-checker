# Design review: what was missed

Synthesis record of an arena review of `system-design.md` (with `spec.md`, `categorisation.md`, `design.md`). The fixes are applied in those docs; this file records what was found, what was decided and what was rejected.

## Method

- **Fan out:** three independent adversarial reviewers (opus, fable, sonnet aliases; the configured arena model ids could not be selected), same prompt, each writing its own report, read-only on the repo. Each was allowed to check claims against the real SMS export, reading only `MobileMoney` messages and reporting counts and anonymised shapes only.
- **Cross-judge:** one separate opus judge scored the reports against a rubric and re-ran the disputed claims on the export. Scores out of 30: C1 28, C2 25, C3 22.
- **Base:** C1 (opus). It was the most accurate on the data (every claim the judge re-ran held), and the only one to find the failed-payment variant.
- **Grafts:** from C2 (fable): poison-batch handling, the id-diff scan, the first/last-letter fuzzy rule, link-and-flag reversals, OTP filtering in Kotlin, versioned seeds, emulator-inbox tests, scan on resume. From C3 (sonnet): the tax-loss evidence, the Android 13 restricted-settings path, cascade deletes of rules, the received-time prevalence.
- **Verification:** I re-ran the three most consequential claims myself on the export. All held: the 12-digit "compact timestamp" is `yyyy dd HH mm ss` (79 of 80 within 5 minutes of the received time; only 14 of 80 are even valid as `yyyyMMddHHmm`); 177 non-OTP messages carry no transaction-id label (392 OTPs, 1,919 labelled); all 6 "has failed" messages carry an id and no balance.

## Findings and what was done

Severity is the judge's. "Applied" names the doc section that now carries the fix.

| # | Sev | Finding | Basis | Status |
|---|---|---|---|---|
| M1 | high | Merge was order-dependent: counterparty conflicts in 102 of 273 same-id pairs (80 cross-shape pairs: real name vs `Merchant NNNNNN`), tax lost when one shape has no Tax field (3 pairs), wrong time winning (20 of 80 pairs), and "fill empty" contradicted "re-parsed fields win" | verified | Applied: `system-design` 5 (`mergeAll`, nullable fee/tax, `merchantCode`), 6, 7.2, 7.3 |
| M2 | high | The "compact timestamp" was misdefined as `yyyyMMddHHmm` | verified | Applied: `spec` 3 and 4; not parsed, received time is used, body time beats received in merge |
| M3 | high | Totals were incomplete and contradictory: unlinked reversals and refunds never subtracted, refunds both income and not, "in" undefined, reversed originals lost their fee and tax even though a reversal credits only the amount (6 of 6) | verified and reasoned | Applied: `system-design` 6 (three named queries); refunds are treated like reversals |
| M4 | high | Reversal linking failed on real data: exact names never matched refunds, reversals had 2 to 5 candidates, 14 days is shorter than MTN's 15 | verified | Applied: `system-design` 7.4 (normalised names, 30 days, closest, flagged when ambiguous, run over all unlinked rows) |
| M5 | high | `Your payment of … has failed` (6 messages) carries an id and no balance and would count as spend under a prefix test | verified | Applied: `system-design` 5 (`ignored:failed`, shape 2 requires `has been completed`) |
| M6 | high | Five concurrent writers on one expo-sqlite connection; `withTransactionAsync` is not exclusive | reasoned | Applied: `system-design` 7.7 (single-flight queue, debounce, exclusive transactions, test) |
| M7 | high | Android can reuse an SMS id after the newest message is deleted, so `INSERT OR IGNORE` could silently drop a new payment | reasoned (confirm on device) | Applied: `system-design` 6 and 7.1 (a seen id with a different `received_at` is a new message); M1 manual test |
| M8 | high | Android 13+ "restricted settings" blocks `READ_SMS` for APKs installed from a browser or file manager; ADB installs are exempt so the developer would never see it | reasoned | Applied: `system-design` 9 (permission state 5), 11 (manual test) |
| M9 | medium | Date cursor misses restored or back-dated messages and clock skew; ids were strings | reasoned | Applied: `system-design` 7.1 (id-diff scan, numeric ids, no date cursor) |
| M10 | medium | Classification: 177 id-less promos and notices would flood `unparsed` and the parse-rate denominator was undefined; `Y'ello Valued Customer` opens promos and reversals alike | verified | Applied: `system-design` 5 (transaction-id label rule, parse rate defined, curly apostrophes); `spec` 4 |
| M11 | medium | One failing write rolled back the whole batch and every later scan failed on it | reasoned | Applied: `system-design` 7.2 (savepoint per message, `error:<code>` rows) |
| M12 | medium | A crash before `finishScan` left reversals unlinked for good | reasoned | Applied: `system-design` 7.4 (link all unlinked rows in `finishScan`) |
| M13 | medium | Deleting a category was undefined; the foreign key rejected it; cascades deleted rules silently; overrides left a stale `manual`; Family/Friends broke on rename | reasoned | Applied: `system-design` 6 (`system_key`, `ON DELETE RESTRICT`), 7.8 (`deleteCategory`) |
| M14 | medium | First import would raise about 700 "needs a reference" prompts plus 134 cash-out prompts from old history | verified | Applied: `system-design` 9 (only after `first_import_at`, only if Misc) |
| M15 | medium | Missing permission states: auto-revoke hiding stored data, OEM service-SMS toggle giving 0 rows | reasoned | Applied: `system-design` 9 (states 1 and 4) |
| M16 | medium | Fuzzy matching false positives (`paste`→`waste`, `batter`→`battery`, `charges`→`charger`); `credit` was both junk and a keyword; seed duplicates vs `UNIQUE` | verified | Applied: `categorisation` (first/last letter rule, `credit` removed from junk); seed-duplicate test in `system-design` 10 |
| M17 | medium | No backup or recovery; DB-open failure unhandled | reasoned | Applied: `system-design` 10 (move aside and rescan; export/import promoted to Should) |
| M18 | medium | Re-parse API mismatch (single-id read vs pages) | reasoned | Applied: `system-design` 8 (`readMessagesByIds`), 7.3, 13 |
| M19 | medium | Missing tests: merge order, id reuse, concurrency, poison message, upgrade, crash, fixture variants; XML export has no `_id` | reasoned | Applied: `system-design` 11 |
| M20 | medium | About 71% of financial messages have no body time, so received time is the norm | verified | Applied: `system-design` 16, `spec` 4 (approximate-time mark) |
| M21 | low | Money grammar: `GHS 2.5` must become 250; commas, trailing dots, `-`, number-before-`GHS`; main amount must fail, not default to 0 | verified | Applied: `system-design` 5 (`parseAmount` returns null) |
| M22 | low | Migrations and seeds not versioned or atomic; re-parse not resumable | reasoned | Applied: `system-design` 10, 7.3 |
| M23 | low | Owner number cannot be inferred from shape 6 (9-digit internal account); normalise numbers and names | verified | Applied: `system-design` 16 |
| M24 | low | OTP bodies reach JS and logcat; fixtures kept real ids and balances | verified | Applied: `system-design` 8, 10, 12 |
| M25 | low | Counterparty hints before type defaults misfile cash-outs and incoming payments | reasoned | Applied: `categorisation` |
| M26 | low | Raw vs cleaned reference stored inconsistently | doc | Applied: `system-design` 5 and 6 (store raw, clean in the resolver) |
| M27 | low | A `MoMoApp` sender (7 messages) contradicts "only MobileMoney" | verified (count only) | **Needs you:** look at those 7 by hand (below) |
| M28 | low | Returning from a USSD payment to a warm app showed nothing new | reasoned | Applied: `system-design` 7.1 (scan on `AppState` → active) |
| M29 | low | `sub_id` changes over time and must not be used | verified | Applied: `system-design` 16 |
| M30 | low | Doc inconsistencies (Home layout, list names, 2,000 vs 2,500, spec 5.2 vs 7.3) | doc | Applied: spec 5.2 and 7.3 reconciled; `design.md` Home layout (3.2) now matches section 4 and the built screens; the debug list has one name. The 2,000 (spec target) vs 2,500 (real inbox size) difference is intentional: the target is a floor |

## Claims the reviewers made that were wrong, and were not used

- One reviewer called the 12-digit value an opaque id. It matches the twin message's ISO time to the second in 74 of 80 cases. Its fix (use received time) is still the right POC choice.
- One reviewer said the "You have Paid" shape carries the owner's phone number (0 of 80 do) and that a `Refund for <id>` reference links a refund (the one such reference holds a 10-digit number matching no id).
- Counts that were off: id-less non-OTP messages are 177 (not about 147), "withheld" notices are 2 (not 3), reversal and refund credits equal the amount in 6 of 6 (not 4 of 4).
- A proposed fuzzy rule (same first letter or length ≥ 6) still lets 2 of its own 3 false positives through. The first/last-letter rule was used instead.
- One reviewer rated id reuse a blocker (overstated: it is high, unconfirmed on a device) and one rated it low (understated).

## Things the review checked and found fine

Sender filtering; multi-part messages arrive assembled (bodies up to 435 characters, none truncated); transaction ids are 11 digits on every labelled message and never conflict on amount, fee or balance within a pair; money formats; ISO body times are UTC and 1 s to 18 min before the received time; no two messages share a millisecond; delivery delay is at most about 3 hours, inside any overlap; fee semantics are consistent across all shapes; the domain/data split, no-text-stored rule and `INTERNET` stripping hold up.

## Needs your decision or action

1. **Look at the 7 messages from the `MoMoApp` sender** in your export and tell me whether they are transactions. If so, the sender goes in the default `senders` list.
2. **Backup and export** moved from "Could" to "Should" (a Settings "Export data / Import data" through the share sheet). Say if you would rather keep it out of the POC.
3. **Test on an Android 13+ phone, installing the APK from a file manager,** at M1. This is the only way to see the restricted-settings block.
4. **One screen design change follows from this review:** the first-import "What were these for?" prompts now cover only transactions after the first import, so the card will not appear on day one with hundreds of old items. The screens in Paper do not need redrawing.
