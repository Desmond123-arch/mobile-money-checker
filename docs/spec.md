# MoMo Spend Tracker: product spec (POC)

Status: draft. Supersedes the original requirements doc where they differ. Categorisation detail lives in `categorisation.md`; screens and visuals in `design.md`.

## 1. What it is

An Android app that reads MTN MoMo confirmation SMS on the device, turns them into a categorised spending history, and shows where the money goes each month. All data stays on the device. Expo dev build with a custom Kotlin module; parsing in TypeScript; storage in SQLite.

Out of scope for the POC: iOS, other networks, live SMS listener, multi-device, web dashboard, ML categorisation, exports, Play Store release. The Go sync backend stays a stretch goal (M5).

## 2. Findings from real data

Source: an SMS Backup & Restore export of one phone (4,592 messages; 2,488 from `MobileMoney`).

- The sender ID is `MobileMoney`. Other MTN senders (`MTN`, `MTN-Just4U`, `MTNUP2U`, `MTN Rewards`) are promos and are ignored.
- About 390 of the `MobileMoney` messages are OTP / login codes. They are never stored or parsed.
- Every financial message has a transaction ID, under three labels: `Transaction ID`, `Transaction Id`, `Financial Transaction Id`.
- The same transaction can arrive as more than one message in different formats, so a naive parse double-counts it.
- Fees and tax are charged on top of the amount. Balances reconcile as `balance_before - (amount + fee + tax) = balance_after`. First check, on 1,321 consecutive outgoing payments: 877 reconcile on amount alone (fee and tax were zero), 408 reconcile only with fee and tax, 36 do not (messages missing from the export). Re-checked with the built parser and merge (`npm run check:sms`, one row per transaction, so a fee or tax missing from one message is filled in from the other): 1,327 payments, 897 on amount alone, 415 with fee and tax, 15 do not reconcile.
- There is no E-Levy in the data. The SMS field is "Tax". The only E-Levy mention is a promo saying the levy was abolished.
- Incoming payments show the sender's reference. Cash-out messages have no reference.
- About 61% of outgoing transactions in this history have an empty or `-` reference. New transactions are expected to carry one (the app nudges the user), so this history is used only to build and test the rules.

## 3. Message shapes in scope

| # | Shape | Direction | Notes |
|---|-------|-----------|-------|
| 1 | `Payment made for GHS x to NAME …` | Out | Reference, fee, tax. Two layouts (`Tax charged: 0.03` and `TAX charged: GHS 0.03`, the second with a dot after the name) that often arrive together for one transaction |
| 2 | `Your payment of GHS x to NAME has been completed at <time>` | Out | Timestamp in body; `name,number,note` references; the reference sits before or after `Your new balance`; ends with a `Financial Transaction Id` and an `External Transaction Id` (never the key) |
| 3 | `Payment for GHS x to NAME` (MTN airtime and bundles, Just4U, Paystack, bills, Other Networks) | Out | No reference |
| 4 | `Y'ello. You have Paid GHS x to Merchant NNN` | Out | Reference is `Message from sender:`; the 12-digit value is `yyyy`+`dd`+`HH`+`mm`+`ss` with no month, so the received time is used |
| 5 | `Cash Out made for GHS x to AGENT` | Out | No reference; fee |
| 6 | `You have transferred x GHS to Other Networks …` | Out | Reference text like `airtime:Telecel:…` |
| 7 | `Payment received for GHS x from NAME` | In | Reference (may be `name,number,note`), fee; the name can be empty. One message from a sender called "Interest …" is also this shape and stays `payment_in` |
| 8 | `Cash In received for GHS x from NAME` | In | Free |
| 9 | `An amount of GHS x has been credited …` (interest) | In | Maps to Income |
| 10 | `Hello, NAME has successfully refunded GHS x to your … account at <time>` | In | Income, links to original; ends `TRANSACTION FEE IS 0` |
| 11 | `… the transfer\|payment of GHS x to NAME has been reversed on <time> with transaction ID: …` | Reversal | Offsets the original (see 5.3). The only shape with a lowercase `transaction ID` |

Counts in the export (messages parsed): shape 1 597, shape 2 458, shape 3 326, shape 4 80, shape 5 134, shape 6 6, shape 7 256, shape 8 43, shape 9 7, shape 10 3, shape 11 3; 6 more are failed payments (ignored). Total 1,913 parsed of 1,919 labelled.

Not stored (recorded as `ignored` in `seen_messages` by id only, no text kept): OTPs, promos, "withheld, pending reversal", "Airtime recharge received" (no transaction ID or balance), PIN-suspended notices.

Focus is the current formats. Older formats (pre-2024 wording) are handled later as new template versions.

## 4. Parsing rules

All money is stored as integer pesewas, parsed from the string, never via floats (`"103.00"` → `10300`).

- **Amount:** `GHS 3.00`, `GHS3.00`, `GHS 10`, `10.00 GHS`; strip `GHS`, spaces, thousands commas, trailing dots. `GHC` is accepted.
- **Fee:** `Fee charged: GHS0.77`, `Fee was GHS 0.05`, `TRANSACTION FEE: 0.00`, `Fee charged: GHS 0.`, `TRANSACTION FEE IS 0`, `Transaction fee is GHS0`. Missing → not stated (null), counted as 0 in totals unless another message of the transaction states it.
- **Tax:** `Tax charged: 0.03`, `TAX charged: GHS 0.03`, `Tax was GHS 0.30`, `Tax charged: GHS0.11`, `,Tax Charged 0`, `Tax was GHS -`. `-` is zero; missing (shapes 4 to 11 have no Tax field) → not stated (null), counted as 0 in totals unless another message of the transaction states it. Stored as `tax_pesewas`.
- **Balance after:** `Current Balance: GHS x`, `Current Balance GHS x`, `Your new balance: GHS x`, `Your new balance:x GHS`, `Your new balance is GHS x`. Shapes 1 and 7 also print `Available Balance`; it is the same number.
- **Counterparty:** name after `to` or `from`; a number when the reference carries one (`name,number,note`).
- **Timestamp:** the ISO time in the body if present; otherwise the SMS received time. The "You have Paid" shape's 12-digit value is not `yyyyMMddHHmm` (only 14 of 80 even parse that way, and all 14 are wrong); it is `yyyy dd HH mm ss` with no month, so it is not parsed. About 75% of financial messages (1,443 of 1,913) have no body time, so most rows use the received time; `occurred_at_source` records which, and the UI marks received-time rows as approximate. When two messages of a transaction disagree, a body time beats a received time.
- **Failed payments:** `Your payment of … has failed` carries a transaction id but no money moves. It is ignored (never spend).
- **Classification:** a message with no transaction-id label is ignored (`no_txn_id`); a labelled message that matches no template is `unparsed`. Parse rate = parsed / labelled messages.
- **Reference:** extracted per `categorisation.md` (last comma-part, junk values treated as empty).
- **Self-transfer:** counterparty or reference number matches the owner's name or wallet number. Flagged `is_self_transfer`; still counted as spend.
- **Total debited** (derived, never stored): `amount + fee + tax`.

Each template has a name and a version. A wording change becomes a new template, not an edit.

## 5. Ingestion

### 5.1 Scan
Read the inbox from the `MobileMoney` sender only. Each scan lists the inbox's message ids and diffs them against the ids already seen, then reads only the new ones (no date cursor, so restored or back-dated messages are caught; ingestion is idempotent). Runs on app open and when the app returns to the foreground. First import of 2,000 messages under 10 s; incremental scan under 1 s. Detail in `system-design.md` 7.1.

### 5.1a Backup import (first-run alternative)
The first load can also come from an SMS Backup & Restore XML export instead of the inbox. This covers phones where the SMS permission is blocked or hidden (Android 13+ restricted settings, MIUI and similar ROMs) and keeps the app usable if `READ_SMS` is ever refused. The user picks the file; the app streams it, keeps only `address="MobileMoney"` messages, and sends them through the same parse and ingest path as the inbox scan. The file is read once and no message text is stored. Backup messages have no Android id, so they carry no live message to show under "Original message". Re-importing a newer backup is safe because transactions dedupe on `momo_txn_id`. Once the user grants SMS access, the inbox scan takes over for new payments. Detail in `system-design.md` 7.9.

### 5.2 Deduplication
Key: `momo_txn_id`. When several messages share an ID, merge them into one row with a commutative per-field rule (a non-null value beats null, a body time beats a received time, a real name beats `Merchant NNNNNN`; `system-design.md` section 5), so the order the messages arrive in never changes the result. A message without an ID is not turned into a transaction.

### 5.3 Reversals and refunds
Stored as their own type with `linked_txn_id`. A reversal cancels the linked original in spend totals (the original stays visible, marked reversed).

### 5.4 Unparsed
A message that matches no template is recorded in `seen_messages` by id with status `unparsed`, and listed in a debug view that reads its text live from the inbox (the text itself is never copied). It never crashes the scan and is never dropped silently.

## 6. Data model

All money columns are integer pesewas. SQLite on device; the same schema in Postgres if sync is built.

| Table | Key fields |
|---|---|
| `transactions` | `id`, `momo_txn_id` (unique), `type`, `direction`, `amount_pesewas`, `fee_pesewas`, `tax_pesewas`, `balance_after_pesewas`, `counterparty_name`, `counterparty_number`, `reference`, `reference_source` (`sms`/`user`), `category_id`, `category_source` (`manual`/`rule`/`keyword`/`default`), `is_self_transfer`, `linked_txn_id`, `occurred_at`, `occurred_at_source`, `sms_id`, `template_name`, `template_version`, `created_at`, `updated_at` |
| `categories` | `id`, `name`, `is_system`, `created_at` |
| `keywords` | `id`, `category_id`, `value`, `is_alias` |
| `name_lists` | `id`, `kind` (`family`/`friend`), `value`, `created_at` |
| `recipient_rules` | `id`, `match_field`, `match_value`, `category_id`, `created_at` |
| `seen_messages` | `android_sms_id`, `received_at`, `status` (`parsed`/`unparsed`/`ignored`), `momo_txn_id`; no message text. Full schema in `system-design.md` |
| `meta` | key-value: `parser_version`, `seed_version`, `first_import_done`, `first_import_at`, `owner_number`; `last_synced_at` and `device_id` only if sync is built |

## 7. Categorisation (summary)

Order: manual tag → recipient rule → reference (family and friends names, then keywords, with typo tolerance) → built-in counterparty rules → type default → Misc. Cash-outs stay in Cash until the user says what the money was for. Family and friends name lists start empty and never include the user's own name unless they add it. Full seed lists and matching rules: `categorisation.md`.

## 8. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Request `READ_SMS` with an explanation screen; handle denial | Must |
| FR-02 | Read only messages from the `MobileMoney` sender | Must |
| FR-03 | Parse each message into a transaction (section 3 and 4) | Must |
| FR-04 | Log and skip unmatched messages without crashing | Must |
| FR-05 | Deduplicate on transaction ID across message shapes | Must |
| FR-06 | Incremental scan: only messages newer than the last scan | Must |
| FR-07 | Transaction list, newest first | Must |
| FR-08 | Detail: fee, tax, balance after, reference, original SMS (read live from the inbox, not stored) | Must |
| FR-09 | Auto-category (section 7) | Must |
| FR-10 | Manual re-tag; set or edit the reference | Must |
| FR-11 | Monthly summary: total out, total in, per-category, fees and tax | Must |
| FR-12 | Recipient rules, applied to past and future | Should |
| FR-13 | Manage categories, keywords, family and friends names | Should |
| FR-14 | Filter list by month, category, direction | Should |
| FR-15 | View unparsed messages | Should |
| FR-16 | "Needs a reference" list on open; cash-out "what was this for?" prompt | Must |
| FR-19 | Import the first load from an SMS Backup & Restore XML file (section 5.1a); show steps to export it | Should |
| FR-20 | Budget: plan a span of days with a total and optional per-category limits; see what is left, the pace and the status; plans never overlap (design 8.15) | Should |
| FR-17 | Opt-in sync to Go backend | Could |
| FR-18 | Export CSV | Could |

## 9. Non-functional requirements

- Privacy: data stays on the device unless sync is on; no message text is stored, only the parsed fields and message ids; only `MobileMoney` messages are read; OTPs are never read into the database.
- Performance: 2,000-message first import under 10 s; incremental scan under 1 s.
- Platform: Android 8.0 (API 26) and above, sideloaded APK.
- Correctness: parser tests pass on every fixture; balances reconcile (section 2); monthly totals match a hand-checked month to the pesewa.
- Offline: everything except sync works with no network.
- App lock (biometric or PIN) before showing transactions: Should.

## 10. Acceptance criteria

- Installs as an APK on Android 8+ and asks for SMS permission with an explanation.
- At least 95% of financial `MobileMoney` messages parse into transactions.
- Reopening the app adds new transactions only, with zero duplicates.
- At least 70% of outgoing transactions get a category without a manual tag, on a phone not used to write the rules.
- Monthly summary matches a hand-checked month to the pesewa, including fees and tax.
- Parser tests pass on every fixture, with at least 5 anonymised samples per shape.

## 11. Fixtures and tests

- Fixtures are anonymised (names, numbers, merchant names scrambled; structure, amounts, fees, balances kept) and committed. The raw export is never committed.
- Tests: each shape; fee and tax variants; amount formats; timestamp formats; dedup across shapes; reversal; unparsed; balance reconciliation on a synthetic sequence; categorisation cases from `categorisation.md`.

## 12. Milestones

| Milestone | Deliverable |
|---|---|
| M0 | Samples collected (done: one export; need a second phone for the 70% test) |
| M1 | Expo dev build, Kotlin module, permission flow, raw messages listed |
| M2 | Templates for each shape, dedupe, unparsed table, fixture tests |
| M3 | SQLite schema, incremental scan, list and detail, backup import |
| M4 | Categorisation, re-tag, names and keywords, monthly summary |
| M5 (stretch) | Go sync |

## 13. Risks

- MTN changes wording: versioned templates, unparsed view, fixture tests.
- Sensitive data: local-first. If data reaches a server, Ghana's Data Protection Act 2012 (Act 843) applies.
- Dual SIM: treated as one wallet.
- Google Play restricts `READ_SMS`: sideload for the POC.
- Tuned on one phone: the 70% categorisation target needs a second phone to validate.

## 14. Open questions

- `paystack` / `cellulant` default category (Misc vs Shopping).
- Whether a self-transfer filter is needed in the list.
- Whether the Go backend stays in the POC.
- Second phone and a friend's anonymised samples for validation.
