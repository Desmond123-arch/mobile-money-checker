---
name: verify-momo-spend
description: Drive the MoMo Spend Android app (Expo, React Native) on an adb-attached emulator through Expo Go and Metro, and capture screenshots plus visible-text proof. Use to confirm a UI change actually renders and behaves on a device, not just that it typechecks.
---

# Verify MoMo Spend

The app is Android only. This skill drives it on the emulator with `adb` and reads the screen through the accessibility tree. Everything goes through `scripts/momo.py`; run it with `python3 -I` from the repo root.

## Launch

1. Metro must be listening on `:8081`. Start it only if `doctor` says it is not: `CI=1 npx expo start --port 8081 > "$SCRATCH/metro.log" 2>&1 &` and remember the PID. Do not pass `--android`. Expo then tries to fetch Expo Go through a missing `ANDROID_HOME` and stalls.
2. Expo Go (`host.exp.exponent`) must already be on the emulator.
3. `python3 -I .claude/skills/verify-momo-spend/scripts/momo.py open` runs `adb reverse tcp:8081 tcp:8081`, opens `exp://localhost:8081`, and taps the `momo-spend` recent entry. Ready means the text `Home` is visible.

If the user is already running Metro and the app, skip the launch and go to Doctor. Never kill a Metro you did not start.

After a fresh install or `adb shell pm clear` the app opens on Permission, not Home. Tap `Not now` first (`tap-id permissionNotNowBtn`); it saves the choice and lands on Home. The ready check above only holds after that. Under Expo Go the database lives in Expo Go's storage, so reset with `adb shell pm clear host.exp.exponent`.

## Doctor

`python3 -I .claude/skills/verify-momo-spend/scripts/momo.py doctor` is read-only apart from refreshing `adb reverse`. It prints the device, whether Expo Go is installed, Metro's `/status`, and the foreground window. Drive only when the device is present, Metro says `packager-status:running`, and the foreground is `host.exp.exponent`.

## Drive

Elements are found by accessibility text or content-description, never by coordinates.

- `tap-id <testID>` and `has-id <testID>` use the element's `testID`, the same ids the Maestro flows use. Prefer them to text.
- `tap "<text>"` taps the element whose text or label matches exactly. Tabs are labelled `Home`, `Transactions`, `Insights`, `Settings`.
- `wait "<text>" [seconds]` blocks until that text is visible.
- `has "<text>"` exits 0 when visible.
- `texts` lists everything on screen.
- `scroll` swipes up one screen. Content below the fold is not in the accessibility tree until you scroll to it.
- `tap-switch` / `switch-state` act on a switch. A row title and its switch share the same label, so plain `tap` hits the title and changes nothing.
- `back` presses Android back. `type "<text>"` types into the focused field.
- `tap-xy` is a last resort.

Feature recipes are in `features/`. Read `features/README.md` first.

## Evidence

Write proof to `artifacts/verify-momo-spend/<feature>/` (git-ignored). For each check keep:

- A screenshot (`shot <path>.png`) after the action.
- The visible-text list (`texts > <path>.texts.txt`).
- The screenshot or text from before the action when the proof is a change.

Prove the real user path by tapping what a user taps. Do not open screens through deep links to claim a tab works. Judge layout from the screenshot (wrapping, clipping, alignment), not only from the text list: wrapped text still shows up in `texts`.

The orange gear at the top right is Expo Go's developer menu button, not app UI. Ignore it.

Animations are not provable from a single screenshot. Report them as not verified unless you capture a frame mid-transition.

## Cleanup

Stop only the processes this run started (the Metro PID you recorded, nothing matched by name). Leave Expo Go installed. Leave `artifacts/` in place.

## Not covered yet

The app has no real data layer or SMS module, so every screen shows sample data. Nothing here verifies parsing, storage, or the permission flow against real messages. That needs a dev build, not Expo Go.
