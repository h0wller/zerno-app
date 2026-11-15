# Fitness evidence verification — technical decision

Status: implementation contract; GPX fail-closed behavior implemented in PR #252
Date: 2026-11-14

## Product requirement

A guest receives a free filter coffee only after Zerno has sufficient evidence that a real running activity took place. Receiving a syntactically valid activity file is not verification.

The reward engine must not infer authenticity from distance, duration, GPS plausibility, file metadata, FIT CRC, or a file fingerprint. These checks detect malformed or suspicious submissions; they do not prove who recorded the activity or whether a person ran it.

## Trust model

Evidence has an explicit verification state:

- `unverified`: uploaded file parsed, but origin is not authenticated.
- `pending_review`: plausibility checks passed; no reward may be issued automatically.
- `verified`: provenance has been established by an approved source-specific verifier.
- `rejected`: malformed, ineligible, duplicated, or failed verification.
- `needs_review`: inconsistent evidence requiring an authorized operator decision.

Only `verified` evidence may enter reward issuance. Manual review can reject suspicious submissions, but a human looking at an ordinary GPX/FIT/TCX file cannot turn it into cryptographic proof. Manual approval must not be represented as device-authenticated verification.

## Evidence sources

### User-uploaded GPX, FIT, TCX

Accept these formats as evidence containers, not as trusted identities.

- Parse in memory with strict byte, point/record, timestamp, coordinate, and duration limits.
- Normalize into a provider-neutral activity summary.
- Run duplicate, temporal, speed, GPS discontinuity, and metadata anomaly checks.
- Store a keyed or cryptographic fingerprint and minimal aggregates only.
- Keep the submission unverified/pending. Do not issue a coffee code solely because these checks pass.

FIT CRC validates file integrity against accidental corruption; it is not a cryptographic signature of a watch or athlete. GPX and TCX have no universal origin attestation.

### Authenticated provider/device sources

A source adapter may mark evidence `verified` only when all of the following are true:

1. The user authenticated directly with that provider/device ecosystem using a supported authorization flow.
2. The provider returns activity data over an authenticated channel and the adapter validates the response schema and ownership.
3. The provider's current terms permit this exact use: eligibility verification and a non-cash coffee reward.
4. The source's provenance is documented and testable; no user-editable export is treated as provider attestation.
5. The integration stores only the minimum evidence needed for deduplication and reward audit.

Each adapter has its own policy/security gate. Strava is not a required source and remains disabled; do not route Strava data or derived eligibility through Telegram, file uploads, or another service as a workaround.

## Phone-first access model

The Telegram bot is the user-facing entry point, not the device-data reader. Users interact with Zerno from their phone; the phone acts as the bridge to the health-data ecosystem already connected to it.

### iOS — Apple Watch through Apple Health

- Apple Watch records workouts and synchronizes them to Apple Health on the paired iPhone.
- A native iOS companion component/app requests the user's explicit HealthKit read permissions and reads eligible workout records (and route data only when needed and separately authorized).
- The companion sends a minimal, normalized evidence assertion to the Zerno backend over an authenticated, short-lived session.
- Telegram can launch the companion/deep link or show connection status, but a Telegram Mini App or ordinary PWA cannot directly request HealthKit access. Do not design this as a JavaScript-only browser integration.
- The user does not need to open the Watch app or upload a file manually after the initial permission/linking flow.

### Android — Health Connect

- A native Capacitor Android adapter now requests only read permissions for exercise sessions and distance, and reads recent running / treadmill sessions on explicit foreground calls.
- The query window is capped at 30 days, distance aggregation is filtered to the session's own data origin, and GPS routes, coordinates, background reads and write permissions are not requested.
- The adapter preserves source package, device and recording-method metadata. Manual entries remain `device_reported`, as do all other Health Connect records; this is not server-verified evidence and cannot issue rewards.
- Health Connect SDK support begins at Android API 26; the provider app is available on Android 9 / API 28 and later. Devices without an available provider return an unavailable state.
- Keep the user journey phone-first; no direct watch-to-Telegram connection is required. Device and vendor apps may write records into Health Connect, so preserve provenance and apply source trust rules.

### Other sources and fallback

- Keep the backend contract provider-neutral so Garmin and other ecosystems can be added through their own authorized APIs/adapters when viable.
- GPX/FIT/TCX upload remains a broad compatibility fallback, but uploaded files are unverified evidence and do not auto-issue rewards.
- Do not make Apple Watch ownership a prerequisite for participating. Users on supported Android devices and other approved ecosystems should be able to use the same bot flow.

### Trust boundary

HealthKit/Health Connect access is stronger provenance than an arbitrary file upload, but it is not absolute proof that a person physically ran. Records may be written by third-party apps, imported, or manipulated. The verifier must inspect source/device metadata, activity type, timestamps, distance/duration, route availability and anomalies; classify the assurance level; and issue rewards only according to a documented policy. Do not describe this as tamper-proof or biometric proof.

The repository contains Capacitor 8 iOS and Android shells. The iOS shell is the native host for the HealthKit bridge; Telegram Mini App and PWA remain browser-only entry points and cannot access HealthKit directly. The first native increment reads running workouts and returns a normalized, device-reported summary to JavaScript. This is provenance evidence, not server-verifiable attestation: it must not be marked `verified` or issue rewards until a server-verifiable device/app attestation flow is implemented. The server-side GPX intake now persists `verification_state='unverified'` and cannot issue rewards.

## Recommended rollout

1. Define a stable server-side evidence contract and source trust levels independent of Apple/Android. The current GPX path is fail-closed and cannot issue a reward.
2. Implement the iOS HealthKit bridge for Apple Watch workouts, with explicit permission UX and minimal data transfer. Initial read-only bridge is present; native build/device verification remains outstanding.
3. Keep Telegram as the onboarding, status, and reward-code interface.
4. Implement Android Health Connect against the same backend contract.
5. Add vendor-specific adapters as separate increments; retain file uploads as unverified fallback.
6. Test permission denial/revocation, no paired watch, workouts written by third-party apps, duplicate workouts, missing route, offline sync, account switching, and reward replay.

## Pipeline and ownership

1. Telegram transport receives a document and applies upload limits.
2. Format adapters parse GPX/FIT/TCX into a common normalized activity contract.
3. Evidence verifier evaluates source provenance and returns a trust state plus machine-readable reason codes.
4. Anti-fraud checks add risk signals; they never upgrade an unauthenticated file to verified.
5. Reward domain accepts only verified evidence, performs atomic duplicate/cooldown checks, and issues one-time codes.
6. Existing staff redemption remains the only coffee redemption path.

The reward domain must own the invariant "unverified evidence cannot issue a reward". Telegram handlers and parsers must not be able to bypass it.

## Required tests

- Valid GPX/FIT/TCX file upload is stored as unverified and produces no reward.
- A plausible but edited file remains unverified.
- A malformed or oversized file is rejected without persisting raw bytes or GPS points.
- Repeated file fingerprint is idempotent for the same guest and rejected across guests.
- Only an explicit verified result from an approved source adapter can issue a reward.
- A caller cannot pass a client-controlled `verified: true` flag to bypass the verifier.
- Duplicate/cooldown checks and reward issuance remain atomic under concurrent submissions.
- Existing one-time cashier/admin redemption and expiry behavior remains unchanged.
- No raw activity payload, coordinates, route polyline, OAuth token, or provider secret appears in logs.

## Rollout

1. Introduce the evidence contract and tests before adding more file formats.
2. Change the GPX pilot so file plausibility no longer auto-issues a reward.
3. Add FIT and TCX parsers as untrusted-file adapters.
4. Integrate one provider/device source only after its terms and provenance model are independently validated.
5. Keep `FITNESS_REWARDS_ENABLED` off in production until the end-to-end verified-source path and reward economics are approved.

## Explicit non-goals

- No Strava policy circumvention or relaying Strava Data through another channel.
- No claim that ordinary GPX/FIT/TCX proves a real run.
- No long-term storage of raw tracks or location histories.
- No automatic reward issuance based only on anomaly scoring.


## App Attest implementation constraint

Apple App Attest must be verified on the server, not trusted from a client flag. Apple's validation requires certificate-chain validation, nonce binding, RP ID/bundle identity checks, credential key extraction, assertion signature verification, and strictly increasing counters. The newest `node-app-attest` release requires Node.js 24, while Zerno is pinned to Node.js 22. The older 1.0.1 implementation was inspected but is not accepted without a security review because it predates current validation guidance. Do not add an unreviewed verifier or enable rewards as a workaround. Resolve the runtime/library choice and configure the Apple Team ID, App Attest environment, and entitlement before implementing the verifier.


## App Attest challenge foundation

The server now issues one-time challenges bound to the authenticated verified guest and to a purpose (`attestation` or `assertion`). Challenges expire after five minutes, are SHA-256 hashed at rest, are single-use through an atomic SQLite transaction, and are rate-limited to ten per guest per minute. This is only the replay-resistant challenge primitive. It does not validate Apple's attestation certificate chain or assertion signatures, does not register public keys, and must not change any activity verification state or enable reward issuance. App Attest verifies the app instance/request integrity; it does not cryptographically prove that the user physically performed a run.
