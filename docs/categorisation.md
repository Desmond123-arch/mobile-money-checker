# Categorisation spec (POC)

Status: draft for discussion. Replaces the categorisation section of the requirements doc.
Scope: outgoing and incoming MTN MoMo transactions parsed from the `MobileMoney` sender.

## Principles

- The **reference** is the main signal. The app nudges the user to always enter one.
- A manual choice always wins.
- Money is spend. Self-transfers are kept in totals and flagged with `is_self_transfer`.
- Fee and tax are charged on top of the amount. Total debited = amount + fee + tax (derived, never stored). Tax is stored as `tax_pesewas` (the SMS says "Tax"; "E-Levy" no longer exists).

## Resolution order

The first rule that applies sets `category_id` and `category_source`.

| # | Rule | `category_source` |
|---|------|-------------------|
| 1 | Manual tag on this transaction | `manual` |
| 2 | Recipient rule (counterparty number or name, user-created) | `rule` |
| 3 | Reference: family and friends names, then keyword lists | `keyword` |
| 4 | Built-in counterparty rules (e.g. `mtn airtime`, `mtn bundle`, `just4u`) | `default` |
| 5 | Type default: cash-out → Cash, incoming → Income | `default` |
| 6 | Nothing matched → Misc | `default` |

Cash-out SMS carry no reference. A cash-out stays in **Cash** until the user answers "what was it for?", which sets a manual category on that transaction.

## Reference extraction

1. Take the free-text note. For shapes with `Reference:` use that field; for the "You have Paid" shape use `Message from sender:`.
2. If the note has commas (`name,number,note`), keep only the last part.
3. Trim and collapse whitespace. The stored `reference_clean` keeps the original case for display; matching lowercases.
4. Treat as **empty**: `` (blank), `-`, `.`, `momo`, `1`, `no`, `merchantpay`, `my number`, `stuff`, `direct`, `debit`. (`credit` is not here: it is an Airtime & Data keyword. A word is either junk or a keyword, never both; a seed test checks this.)
5. Split into tokens on anything that is not a letter or digit (`bread+egg` → `bread`, `egg`).

A transaction with an empty reference is listed under **Needs a reference** (see Prompting).

## Matching

Applied to the tokens of the cleaned reference, and to multi-word phrases after collapsing spaces (so `ground nut` and `groundnut` both match).

- Exact match against a keyword, always.
- Fuzzy match (misspellings): a token of 5–8 letters matches a keyword within edit distance 1 (Damerau-Levenshtein, so a swapped pair counts as one); 9+ letters allow distance 2. Tokens under 5 letters are exact-only, so `car` never matches `card` and `pie` never matches `pig`. **Edits may not touch the token's first or last letter.** On the real export this gave 7 of 7 correct (`waskye`, `wayer`, `noodkes`, `launch`→`lunch`) and removed the 3 wrong matches that plain distance-1 produced (`paste`→`waste`, `batter`→`battery`, `charges`→`charger`). Keep these three as test cases.
- Alias list for common misspellings that fuzzy matching would miss or get wrong (`waskye`, `wayer`, `kenky`, `shitor`).
- If a fuzzy token is within range of keywords in two categories, the nearer one wins; a tie goes to the category higher in the priority order below.
- A reference can name several things (`bread egg`). The first matching category in priority order wins. Splitting one payment across categories is out of scope.

Priority order inside rule 3: Family names, Friends names, then keyword categories in the order of the table below.

## Names

Two user-managed lists, both **empty by default**:

- **Family names** (e.g. `maa`, `paa`).
- **Friends names**.

The user's own name is never matched by default. If the user types it into a list, it matches like any other. Names use the same exact/fuzzy matching, so `akosue` can match `akosua`. A name match beats a keyword (`andy bread` → Friends).

## Seed categories and keywords

`Family`, `Friends` and `Misc` have no keywords. `Cash` and `Income` are assigned by type default and by user choice, not by keyword.

| Category | Keywords (seed, user-editable) |
|---|---|
| Airtime & Data | airtime, bundle, data, recharge, credit, top up, topup |
| Food | rice, jollof, fried rice, waakye, banku, kenkey, kenky, fufu, omotuo, rice balls, gari, gari and beans, red red, yam, kontomire, palava sauce, light soup, groundnut soup, palm nut soup, soup, stew, fish, tilapia, chicken, meat, kebab, khebab, shawarma, pizza, burger, sausage, egg, eggs, bread, tea bread, sugar bread, butter bread, beans, koko, hausa koko, porridge, oats, indomie, noodles, spaghetti, macaroni, plantain, kelewele, kokonte, tuo zaafi, tz, fufu, ampesi, boflot, bofrot, togbei, doughnut, pie, meat pie, cake, biscuit, snack, snacks, groundnut, ground nut, nkate, tomatoes, onion, pepper, salt, oil, sugar, milk, nido, yoghurt, yogurt, drink, juice, water, sobolo, bissap, lamugin, coke, fanta, malt, lunch, dinner, breakfast, food, chop, groceries, provisions, market, provision, kiosk, restaurant, joint, snack bar |
| Transport | trotro, tro tro, taxi, uber, bolt, yango, fuel, petrol, diesel, bus, fare, transport, okada, aboboyaa, ticket, stc, vip, toll, parking |
| Rent & Bills | rent, ecg, electricity, light bill, water bill, gwcl, bill, bills, wifi, internet, dstv, gotv, startimes, tv, school fees (see Education), waste, maintenance, hostel, motel, accommodation, lodging, loan, instalment, installment |
| Shopping | clothes, cloth, shoes, slippers, bag, shirt, shirts, dress, trousers, jeans, jumia, melcom, mall, shop, shopping, market, perfume, watch, comb, sponge, tape, stationery, pen, paper, stickers |
| Electronics | charger, battery, earpiece, earbuds, ear buds, headphone, keyboard, mouse, hard disk, cable, usb, adapter, phone, laptop, screen, speaker, powerbank, power bank, controller |
| Health | pharmacy, chemist, drugs, drug, medicine, hospital, clinic, doctor, lab, scan, test, malaria, paracetamol, vitamins, inhaler, nhis, dentist, eye, glasses, checkup |
| Education | school, fees, tuition, books, book, exam, course, class, lecture, printing, photocopy, forms, form, registration, project, assignment, udemy |
| Entertainment & Subscriptions | spotify, netflix, youtube, showmax, movie, cinema, game, games, esports, betting, bet, sportybet, subscription, music, party, club, outing, trip |
| Personal Care | haircut, hair cut, barber, salon, braids, hair, makeup, nails, soap, toiletries, lotion, deodorant, toothpaste, shaving, laundry |
| Giving | offering, tithe, church, mosque, donation, gift, funeral, wedding, contribution, welfare, dues |
| Savings & Investing | susu, savings, save, invest, investment, mutual fund, treasury, piggy |
| Services | tailoring, tailor, repair, fix, delivery, courier, rider, plumber, electrician, mechanic, design, printing service, photographer |

Notes:
- A keyword appears in only one category. The table above repeats `market`, `fufu` and `printing`, and mentions `school fees` under Rent & Bills; `src/domain/categorise/seed.ts` keeps each word in the first category that lists it (Food, Food, Education) and drops the rest. A test asserts no word is listed twice and none is also junk. `kenky` moved to the alias list with `waskye`, `wayer` and `shitor`.
- The priority order is stored as `categories.sort_order` (seed step 2), because the database tie-break reads it.
- Keyword lists are a starting point. Users add, remove or move keywords per category, and add or rename categories.

## Built-in counterparty rules

Matched as case-insensitive substrings of the counterparty name, only when the reference gave no category.

| Counterparty contains | Category |
|---|---|
| `mtn airtime`, `mtn bundle`, `mtnbundle`, `just4u`, `other networks`, `telecel push`, `mtn` | Airtime & Data |
| `bills` | Rent & Bills |
| `paystack`, `mojopay`, `cellulant` | Misc until the user chooses (these are online payments with no fixed meaning) |

Rule 4 (built-in counterparty rules and word hints) applies only to **outgoing, non-cash-out** transactions. Cash-outs and incoming payments skip the reference and go to rule 5 (a recipient rule still applies first), so a cash-out to an agent called "… Food Ventures" stays in Cash and an incoming payment from a business stays Income.

Counterparty word hints (apply to names that look like businesses): `food`, `joint`, `chop bar`, `kitchen` → Food; `pharmacy`, `chemist`, `clinic` → Health; `fuel`, `filling` → Transport. Other business words (`enterprise`, `ventures`, `limited`, `consult`) give no signal.

## Prompting

- **Needs a reference.** On app open, transactions with an empty reference (and not cash-outs) appear in a list at the top of the home screen: show the counterparty, amount and date, and let the user type a reference or pick a category. Entering a reference re-runs the rules; picking a category sets a manual tag.
- **Cash-outs** show a "What was this for?" prompt that sets a manual category.
- The app reads the SMS inbox; it cannot write a reference back to MoMo. The reference lives in the app only (`reference` column, user-edited).
- If the SMS already carries a reference, show it and categorise from it; no prompt.

## Data model changes (vs requirements doc)

- `transactions.elevy_pesewas` → `tax_pesewas`.
- `transactions.is_self_transfer` (bool).
- `transactions.reference_source`: `sms` | `user`.
- `categories`: add Health, Education, Entertainment & Subscriptions, Personal Care, Giving, Savings & Investing, Electronics, Services, Friends, Misc; drop Other and Self.
- `name_lists(id, kind: family|friend, value, created_at)`.
- `keywords(id, category_id, value, is_alias)` replaces `categories.keywords[]` so edits are row-level.

## Real-export result

On the author's export (1,194 outgoing, non-cash-out transactions) 77.1% land outside Misc: Airtime & Data 42.1% (almost all from built-in counterparty rules), Food 24.7%, Misc 22.9%, Rent & Bills 4.3%. 57.9% have no usable reference. 104 non-empty references fell to Misc; only 3 are within one plain edit of a keyword, so the first/last-letter rule costs almost nothing. Family and Friends are 0% until the user adds names. This phone was used to write the rules, so the figure is an upper bound for the 70% criterion. Reproduce with `npm run check:categories -- <export.xml>`.

## Success measures

- 70% of outgoing transactions categorised without a manual tag (acceptance criterion) on a real inbox, measured on a phone that was not used to write the rules.
- Parser fixtures cover each reference shape: plain note, `name,number,note`, `Message from sender:`, empty, `-`.
- Matching tests: exact, one-letter typo, swapped letters, 4-letter exact-only, tie-breaking, name beats keyword, multi-word phrase.

## Open points

- `paystack` / `cellulant` default: Misc vs Shopping.
- Whether a "Self transfer" filter belongs in the list screen (flag exists, no category).
- Wording of the nudge for new transactions without a reference.
