# MoMo Spend Tracker: design (POC)

Status: draft. Companion to `spec.md`. The visual work is being built in Paper (file "Xenodochial willow"); this doc is the source of truth for the brief and the screens.

## 1. Direction

**Mood: signage.** A hand-painted kiosk or market sign: ink black, white ground, one loud yellow. Chosen over the usual finance moods (maritime, botanical). Yellow sits close to MTN's brand colour; it stays as a highlighter, not a logo colour, and can be shifted if that feels too close.

Principles:
- Information lives directly on the surface. Rows and strips, no boxed cards.
- Big numbers, light labels. Strong contrast between display and caption weight.
- Warm voice in the copy; never a lecture about money.
- Light mode only for the POC.

## 2. Tokens

| Token | Value | Use |
|---|---|---|
| `--color-ground` | `#FFFFFF` | Backgrounds |
| `--color-ink` | `#14110F` | Text, bars, primary buttons |
| `--color-signal` | `#F5B800` | The one accent: highlights, the main number's underline, the current month |
| `--color-muted` | `#444444` | Secondary text |
| `--color-hairline` | `#EEEEEE` | Dividers, chips |
| `--color-in` | `#1F7A4D` | Money in (semantic only) |
| `--color-warn` | `#B3261E` | Errors, denied permission |

Type: Inter (confirm availability before use). Sizes in px: display 44 bold, title 24 semibold, section 20 semibold, body 16 regular, caption 13 regular. Tabular figures for all amounts. Tight tracking on display, open tracking on small caps labels. No text below 13 px.

Spacing: 4-based; 16 px side gutter; 24 between groups; 40 between sections. Radius: 12 for chips and sheets, 0 for rows.

Amounts: `GHS 1,234.50`, with the pesewas in a lighter weight. Money out is ink with a leading minus; money in is `--color-in` with a plus.

## 3. Screens (390 px wide)

### 3.1 Permission
- Headline: "Let us read your MoMo messages."
- Three short lines: only messages from MobileMoney are read; everything stays on this phone; nothing is uploaded.
- Primary button "Allow SMS access". Text link "Not now".
- Second option under the primary button: "Import a backup file". It opens a sheet with the steps: install SMS Backup & Restore, back up messages (choose the MobileMoney conversation or all messages), save the XML to the phone, then pick it here. Both options lead to the Importing screen for the first load. After an import, Home asks once for SMS access so new payments appear on their own; declining keeps the app working on the imported data with the "SMS access is off" banner.
- Denied state: explains how to enable it in Settings; offers a "Try again" button. App stays usable with an empty state.

### 3.2 Home
Top to bottom:
1. Dark hero: month pill, "Spent so far this month" total (display size), a daily spend chart with the biggest day in yellow, and a row of money in, fees and tax, and payments.
2. **What were these for?** card (yellow, hard shadow): count of payments with no note, tap to open the list. Hidden when empty. Only for transactions after the first import.
3. Where it went: the category share bar and the top 3 categories, with "See insights" for the rest.
4. Recent: the 3 latest payments, with "See all".

Empty state (no messages yet): "Nothing yet. Make a MoMo payment and it will show up here." First-import state: progress with the count of messages read.

### 3.3 Transactions
- Filter chips: month, category, direction.
- Rows: counterparty, reference or category, amount (right-aligned), date. Fixed-width slots so the amounts align in one lane.
- Grouped by day. Reversed items show struck through with a "Reversed" tag.
- A "Needs a tag" chip filters to Misc.

### 3.4 Transaction detail
- Large amount, counterparty, date and time (with a small note when the time came from the SMS received time).
- Breakdown: amount, fee, tax, total debited, balance after.
- Reference field (editable, shows source: from SMS or entered by you).
- Category picker with chips; changing it sets a manual tag. "Always tag this recipient as X" toggle creates a recipient rule.
- Raw SMS in a collapsed section.
- Cash-out: a prominent "What was this for?" prompt until answered.

### 3.5 Settings
- Categories: list, add, rename, delete; open one to edit its keywords.
- Family names and Friends names: chips with an add field. Helper line: "Names in a reference tag the payment automatically."
- Messages we couldn't read (the debug list; also called "unparsed" in the system design).
- About and privacy: what is read, what is stored.

### 3.6 Sheets
- **What was this for?** (cash-out): category chips, optional note.
- **Add a reference**: one text field and a category fallback.

## 4. Navigation

Floating black tab bar with four tabs: Home, Transactions, Insights, Settings. The active tab is a yellow pill with a label; the others are icons only. Detail, Edit category and sheets open over the tabs.

- **Home** is a glance: the month total with a daily spend chart, money in, fees and tax, the "What were these for?" card, the top 3 categories, and the 3 latest payments.
- **Insights** holds the charts: category share, spend by weekday, and six months of money out and in.
- **Transactions** is the full list, grouped by day, with filter chips.
- **Settings** manages categories and their words, family and friends names, unread messages, app lock and privacy.

There is no separate Monthly Summary screen. The month selector changes everything on Home and Insights.

## 4.1 Neobrutalist accents

A small dose, used only on action elements: 2px ink borders with a 4px hard offset shadow on the "What were these for?" card, primary buttons, text inputs, the "New category" button and the Permission screen's icon tile; 2px borders and no shadow on category and name chips; a dashed border for "add" chips. Charts, lists and type stay clean and flat. No other hard shadows.

## 5. States to design

- First run (permission), denied, importing, empty month.
- Home with and without a "Needs a reference" strip.
- Transaction with and without a reference; reversed; self-transfer (small "to yourself" tag, still counted as spend).
- Parser failed on a message: shown only in Settings > Unparsed, never in the main list.

## 6. Accessibility

Contrast at least 4.5:1 for body text on the ground; yellow is never used as text on white (it is a fill or underline only). Tap targets at least 44 px. Amounts are read as "minus 103 Ghana cedis".

## 7. Build order in Paper

All screens are designed in the Paper file "Xenodochial willow", one artboard each: Home, Transactions, Insights, Transaction detail, Settings, Edit category, Unread messages, Permission, Permission denied, Importing, Home (empty), and three sheets (Cash-out "What was this cash for?", Add a note, New category). Not designed: a reversed or self-transfer row, error banners, and a light/dark toggle (light only for the POC).

## 8. Changes after the first device review

These are the current behaviours. Paper has not been updated for items 2 to 6 yet (its weekly limit was hit); this section is the source of truth until it is.

1. **Month picker.** The month pill on Home and Insights opens a sheet listing the months. The choice drives both screens.
2. **Filters and search.** The Home filter button and the Category pill open a category sheet. Transactions has a search field. When a category filter is on, the row shows "Showing Food only" with a Clear button.
3. **No fees and tax in the UI.** Home's totals row is Money in, Payments and A day (the average spend per day so far), as three equal columns, each centered, with hairline dividers. Transaction detail shows Amount and Balance after.
4. **Add an expense.** A yellow "+" on Home and on Transactions opens a sheet: amount, what it was for, category, and Today or Yesterday. Added expenses are tagged "Added by you" and count towards Home's totals.
5. **Insights calendar.** The period pill on Insights opens a calendar sheet with a Day and a Month switch. Day shows a month grid (Mon to Sun, with prev and next month); tapping a date filters the page to that day, and "Show all of October" goes back to the month. Month shows the months as tiles. With a day chosen, "Where it went" is replaced by that date's spending, with a Whole month button. A day with no payments says so, and a day that has not happened yet says that and shows an average day of that name. The weekday bar chart is gone; the month chart stays.
6. **Messages we couldn't read.** Each message has Copy text and Ignore, payment-looking ones also have Add by hand. Ignoring the last one shows an empty state.
7. **Backup import.** The Permission screen offers "Import a backup file" beside "Allow SMS access" (section 3.1). The Importing screen, with its count of messages read and payments found, serves both paths. The import steps sheet is not designed in Paper yet.
8. **First-run gate and Settings import.** A fresh install opens on Permission, not Home; the splash stays up until the app has decided. "Not now" is a link on Permission that saves the choice and goes to Home (it no longer opens Permission denied). Settings, under More, has an "Import a backup file" row above "Messages we couldn't read". Its subtitle is "Add messages from an SMS Backup & Restore export", or "Last imported 21 Jun 2026" once an import has finished. It opens the same steps sheet as Permission. Not designed in Paper yet.
9. **App lock.** Settings, More, "Lock the app" is a real switch with the subtitle "Ask for your fingerprint, face or screen lock when you open the app". Turning it on or off opens the system prompt ("Unlock MoMo Spend") first. On a phone with no screen lock the subtitle becomes "Set a screen lock in your phone's settings first" and the switch is dimmed and does nothing. With the lock on, the app opens on a lock screen: the lock tile, "MoMo Spend is locked.", one line of help and an "Unlock" button, with the prompt opening by itself. Coming back after more than 30 seconds away shows it again. The lock hides the screens; it does not encrypt the data, and the copy never says it does. Not designed in Paper yet.
10. **No row outlines.** Information sits on the surface: rows, legends and lists have no hairline rules above or below, and spacing separates them. Applies to Settings, Privacy, Unread messages, Transaction detail breakdown, the onboarding step list, the Home and Insights legend, and Delete category. The "Original message" toggle is a tinted pill. The hairline dividers in Home's hero totals (item 3), the Month sheet and the Insights month-axis rule are not yet changed. Section 4.1 accents are unchanged.
11. **Insights year and all time.** The calendar sheet (item 5) gains two more switches, Year and All time. Year shows a grid of the years that have data; tapping one shows that year. All time has no picker, only a "Show all time" button. The pill then reads the year or "All time". The choice applies to Insights only: Home and Transactions keep following the last day or month picked, and picking a day or month later replaces a year or all time. The year view has three tiles (Spent, Money in, Payments), a comparison line ("12% more than 2025" with an arrow up, "12% less" with an arrow down, "About the same as 2025" with none; hidden when the year before spent nothing), a 12-month chart of money out that fits the phone width by drawing one bar per month, the biggest month, and "Where it went" for the year. A year with no payments says so. The all-time view shows the span ("Apr 2024 to Jun 2026"), the same three tiles, a bar per year (out and in; out only past five years), the busiest year and month, and category share over everything. A history of one year or one month still renders: the busiest line and the comparison drop out instead of dividing by zero.
12. **Wrapped.** The year view and the all-time view of Insights have a yellow "View your wrapped" button with the section 4.1 border and shadow (disabled, with a one-line note, when no money went out in that scope). It opens a full-screen story at `/wrapped` (`scope=year&year=2025` or `scope=all`). A segmented progress bar sits at the top with a close button beside it; tapping the right two thirds goes to the next slide and the left third to the previous one. Each slide has a solid background (ink, signal yellow, white, or the top category's colour), a tiny uppercase label, one huge number that counts up, and one short warm line. Slides, skipped when their data is missing: intro ("Your 2025, wrapped" or "Your whole MoMo story" with the span), total spent with the payment count and money in, top category with its share, biggest single payment (who and when), the person or place paid most by spend and by count, busiest month (busiest year for all time) with the busiest weekday, the average day with the number of days with no spending, and a closing line with a Done button and one line saying names stay on the phone. Every sentence is built from the numbers shown; no judgement about money. Animations are a slide-in and a count-up, and both are skipped when the phone asks for reduced motion. Sharing as an image is not built. Not designed in Paper yet.

13. **Wrapped music.** The story plays background music from the app itself (works offline): five tracks in order, looping from the last to the first, fading in over about 800 ms. The first track rotates, so each time Wrapped opens it starts with the one after the last one that started. A speaker icon button sits in the top bar between the progress bar and the close button; it mutes and unmutes and the choice is remembered. A small 12 px line under the bar shows the track title, plus the licence credit when a track needs one, at 70% opacity and non-interactive. Music pauses when the app goes to the background, stops on close, and gives way to other apps' audio. When the phone cannot play it, the button and the line are not shown. The tracks are placeholders for now. Not designed in Paper yet.
