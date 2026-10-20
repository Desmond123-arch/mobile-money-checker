# Tab navigation

The floating black bar switches between Home, Transactions, Insights and Settings. The active tab is a yellow pill with its name; the others are icons.

## Sub-features

- `tab-switch` tapping an icon moves the yellow pill to it and shows that screen.
- `tab-label` only the active tab shows a text label.

## How to get to it (user POV)

- Tap any tab icon in the bar at the bottom of any tab screen.

## Driving it with momo.py

Preconditions: baseline, `Home` visible.

- **To Transactions.** `python3 -I $M tap Transactions`, then `python3 -I $M wait "Today · Tue 20 Oct" 15`. The heading `Transactions` and the day group are on screen.
- **To Insights.** `python3 -I $M tap Insights`, then `python3 -I $M wait "Fridays cost you most" 15`.
- **To Settings.** `python3 -I $M tap Settings`, then `python3 -I $M wait "Categories" 15`.
- **Back to Home.** `python3 -I $M tap Home`, then `python3 -I $M wait "Spent so far this month" 15`.
- **Proof.** After each switch run `python3 -I $M shot artifacts/verify-momo-spend/tab-navigation/<tab>.png`. The pill in the screenshot sits on the tab just tapped and shows its name.

## Gotchas

- The bar floats over content. Content under it needs `scroll` before it is reachable.
- The slide animation is not provable from one screenshot.
