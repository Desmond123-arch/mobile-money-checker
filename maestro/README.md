# Maestro flows

End-to-end flows for the Android app, laid out like Bluesky's `__e2e__` folder: `config.yml` picks the flows, `setupApp.yml` launches a clean app, `flows/` holds one file per user journey.

## Run

```sh
npm run e2e                                   # every flow
maestro test maestro/flows/tab-navigation.yml # one flow
```

Needs a dev build (`npm run android`) installed on the device, because the flows use the app id `com.momospend.app`. Expo Go has a different app id and cannot be driven by these flows.

A fresh install opens on Permission (the first-run gate). `setupApp.yml` runs `flows/_skipOnboarding.yml`, which taps `permissionNotNowBtn` when it is visible, so flows can keep assuming Home. `_skipOnboarding.yml` is a helper; `flows/**` also runs it on its own, which is harmless.

## testID convention

Every element a flow touches has a camelCase `testID`. Maestro reads it as the Android `resource-id`, so flows use `id:` and never rely on visible text.

- Screen roots: `<screen>Screen` (`homeScreen`, `settingsScreen`), sheets `<name>Sheet`.
- Tab bar: `tabBar<Name>Btn`.
- Buttons and links end in `Btn` or `Link`; inputs end in `Input`; switches end in `Toggle`.
- Items in a list append the id after a dash: `transactionRow-t3`, `categoryRow-food`, `legendRow-rent`.
- Shared controls take a `testID` prop (`Button`, `TextLink`, `CategoryChip`, `WordChip`, `DashedChip`, `Toggle`, `Screen`, `Sheet`). Add one whenever you add an element a flow needs.
