# Android Health Connect — native adapter

## Scope

The Android Capacitor 8 adapter reads recent running and treadmill sessions from Health Connect. It requests only `READ_EXERCISE` and `READ_DISTANCE`. It does not request write, background-read, route, location, heart-rate or other health permissions. Reads are foreground-only, capped at 30 days and 25 workouts, with distance aggregation restricted to the session's own Health Connect data origin.

## User flow

1. The guest opens their profile in the installed Android app.
2. Zerno checks Health Connect availability without requesting permission.
3. The user explicitly selects **Подключить Health Connect**.
4. Android displays its Health Connect permission UI.
5. After permission is granted, the user explicitly loads recent running sessions.
6. Zerno displays date, distance, duration, source package and recording method in the profile.

The section is not shown in browser PWA, iOS, Telegram Mini App, staff profiles or unverified guest profiles.

## Evidence contract

The adapter returns the same core fields as the HealthKit adapter: `id`, `activityType`, `startedAt`, `endedAt`, `durationSeconds`, `distanceMeters`, `sourcePlatform`, `sourceName`, `sourcePackageName`, `deviceName`, `deviceModel`, `sourceProductType`, and `evidenceState=device_reported`.

Android additionally preserves `recordingMethod`: `actively_recorded`, `automatically_recorded`, `manual_entry`, or `unknown`. Unknown provider values are normalized to `unknown`.

These values are device-reported provenance, not cryptographic proof. Third-party apps can write or import Health Connect records. Manual entries are retained as a signal, never upgraded to verified. The profile UI keeps summaries in memory until the user explicitly selects **Отправить сводки на проверку**. The normalized summaries are then sent to the common evidence intake and stored as unverified; the client cannot issue rewards.

## Platform and publication

- SDK: `androidx.health.connect:connect-client:1.1.0`.
- SDK API support: Android 8 / API 26+; the Health Connect provider is available on Android 9 / API 28+.
- The manifest declares only the read permissions and package visibility query.
- The permission rationale activity opens the published privacy policy URL.
- Google Play Console still requires the Health apps declaration, a privacy policy, and a clear justification matching the exact requested data types and user-facing purpose. Do not submit or publish until those declarations are reviewed and approved. No background access is requested.

## Verification status

- JavaScript normalization: `tests/unit/fitness-healthconnect.test.mjs`.
- Kotlin mapping: `android/app/src/test/java/online/andcoffee/app/HealthConnectWorkoutMapperTest.kt`.
- CI native job: `Android / Health Connect bridge`, runs `./gradlew :app:testDebugUnitTest :app:assembleDebug`.
- Real-device verification is still required for provider availability, permission grant/deny/revoke, records from multiple sources, empty sessions and returning from the permission screen.

Do not describe Health Connect summaries as verified and do not issue rewards from this adapter. Server-side source verification and the common submission API are separate unfinished work.
