# Settings toggles

The Settings tab lists categories, people names and a More section with a Lock the app switch.

## Sub-features

- `app-lock` the Lock the app switch cannot be turned on without a phone screen lock, and says why. With a screen lock it asks for authentication first, which `tap-id` cannot satisfy.

## How to get to it (user POV)

- Tap the `Settings` tab, then scroll to the More section.

## Driving it with momo.py

Preconditions: baseline.

- **Open.** `python3 -I $M tap Settings`, then `python3 -I $M wait "Categories" 15`.
- **Reach the switch.** `python3 -I $M scroll` twice. `python3 -I $M switch-state "Lock the app"` prints `checked=false`.
- **Turn on.** `python3 -I $M tap-switch "Lock the app"`. `python3 -I $M switch-state "Lock the app"` prints `checked=true`. The screenshot shows the thumb on the right and yellow.
- **Turn off.** Tap again. It prints `checked=false`.
- **Proof.** `python3 -I $M shot artifacts/verify-momo-spend/settings-toggle/<name>.png` before and after.

## Gotchas

- Plain `tap "Lock the app"` hits the row title and changes nothing. Use `tap-switch`.
- The switch is not saved anywhere. It resets when the app reloads.
