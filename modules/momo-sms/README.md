# momo-sms

Local Expo module (Android only) that reads the SMS inbox for one sender, `MobileMoney`. Contract: `docs/system-design.md` section 8. Only `src/scan` may import it (ESLint enforces this).

**Status: written but never compiled.** The authoring machine has no Android SDK. The first compile happens in an EAS dev build (`npm run build:dev`). Nothing here has run on a device. Where an API was used from memory it was checked against the sources in `node_modules/expo-modules-core`.

## JS surface (`src/index.ts`, types in `src/types.ts`)

```ts
momoSms.getPermissionStatus(): Promise<'granted' | 'denied' | 'blocked' | 'undetermined'>
momoSms.requestPermission():   Promise<same>
momoSms.listMomoMessageIds():  Promise<{ androidId: number; receivedAt: number }[]>
momoSms.readMessagesByIds(androidIds: number[]): Promise<{ androidId; sender; body: string | null; receivedAt; isOtp }[]>
momoSms.addInboxChangedListener(cb): { remove(): void }
```

- `blocked` means the system will not show the dialog: "don't ask again", or the Android 13+ restricted setting for an APK installed from a browser or file manager.
- Ids are numbers (Kotlin `Long`). Compare them as integers, never as strings.
- An OTP (body starts with `<#>`) comes back with `body: null` and `isOtp: true`. The text is dropped in Kotlin.
- A listener starts the native observer on the first `add` and stops it on the last `remove`.

## Android APIs used

| Need                         | API                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission state and request | `appContext.permissions` (`expo.modules.interfaces.permissions.Permissions`): `getPermissions(PermissionsResponseListener, vararg String)` and `askForPermissions(...)`. `PermissionsResponse.status` and `.canAskAgain` map to the four states. `canAskAgain == false` with a denied status is `blocked` |
| Declaration                  | `android.permission.READ_SMS` in `app.json` `android.permissions`. No `RECEIVE_SMS`                                                                                                                                                                                                                       |
| Reading                      | `ContentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, projection, "address LIKE ? [AND _id IN (?,...)]", ["MobileMoney"] + ids, "_id ASC")`                                                                                                                                                             |
| Sender match                 | SQL `LIKE` with a wildcard-free pattern is ASCII case-insensitive equality. Each row is checked again with `equals(ignoreCase = true)`                                                                                                                                                                    |
| By-id reads                  | Chunks of 500 ids, so 501 bound variables, under SQLite's 999 limit                                                                                                                                                                                                                                       |
| OTP filter                   | `body.startsWith("<#>")` in `InboxReader.readByIds`                                                                                                                                                                                                                                                       |
| Change events                | `ContentResolver.registerContentObserver(Telephony.Sms.CONTENT_URI, true, ContentObserver)` on the main looper. `Handler.postDelayed` debounces by 1000 ms and then `Module.sendEvent("onInboxChanged")`                                                                                                  |
| Events and functions         | `expo.modules.kotlin` DSL: `Events`, `AsyncFunction`, `Function`, `OnDestroy`, and `Record` classes for return values                                                                                                                                                                                     |

## Things to check first on a device

- The build compiles (Kotlin and Gradle were never run).
- `ContentResolver.query` accepts the `LIKE` selection on the SMS provider on the test phone.
- `getPermissionStatus` returns `undetermined` before the first request and `blocked` after "don't ask again".
- A `Long` id round-trips through a JS array as an integer.
