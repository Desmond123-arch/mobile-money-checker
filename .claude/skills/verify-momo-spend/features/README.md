# MoMo Spend verification map

Read this before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Emulator attached to `adb`, Expo Go installed, Metro answering on `:8081`. `python3 -I .claude/skills/verify-momo-spend/scripts/momo.py doctor` must report all three.
- The project is open in Expo Go and `Home` is visible. If not, run `momo.py open`.
- Every screen shows built-in sample data (October 2026, GHS 1,240.50 spent). Nothing reads real SMS yet.

## Driving conventions

- Write `M=.claude/skills/verify-momo-spend/scripts/momo.py` and call `python3 -I $M <command>` from the repo root.
- Find elements by label: tabs are `Home`, `Transactions`, `Insights`, `Settings`.
- Content below the fold needs `scroll` first.
- Look at the screenshot for layout. Wrapped or clipped text still appears in `texts`.
- Do not mention or click the orange gear at the top right. It is Expo Go's menu.

## Proof and skip reporting

- Evidence goes in `artifacts/verify-momo-spend/<feature>/`: a screenshot after the action and the `texts` output.
- Report an unreachable path with the command tried and the precondition that failed. Do not substitute a different path.
- Animations and the permission, importing and denied screens are not verified by the current recipes.

## Features

- [Tab navigation](./tab-navigation.md) covers switching between the four tabs.
- [Insights](./insights.md) covers the category legend and the two bar charts.
- [Settings toggles](./settings.md) covers the Lock the app switch and the rows around it.
