# Fitness evidence verification — technical decision

Status: implementation contract; GPX fail-closed behavior implemented in PR #252
Date: 2026-11-15

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

- A native Capacitor Android adapter and Android-only profile flow request only read permissions for exercise sessions and distance, and read recent running / treadmill sessions after explicit user actions. The UI keeps returned summaries in memory and does not send them to the server.
- The query window is capped at 30 days, distance aggregation is filtered to the session's own data origin, and GPS routes, coordinates, background reads and write permissions are not requested.
- The adapter preserves source package, device and recording-method metadata. Manual entries remain `device_reported`, as do all other Health Connect records; this is not server-verified evidence and cannot issue rewards.
- Health Connect SDK support begins at Android API 26; the provider app is available on Android 9 / API 28 and later. Zerno keeps its Android API 24 minimum: the native plugin is registered only on API 26+, while older versions report `android_version_unsupported` without loading the Health Connect SDK.
- Keep the user journey phone-first; no direct watch-to-Telegram connection is required. Device and vendor apps may write records into Health Connect, so preserve provenance and apply source trust rules.

### Other sources and fallback

- Keep the backend contract provider-neutral so Garmin and other ecosystems can be added through their own authorized APIs/adapters when viable.
- GPX/FIT/TCX upload remains a broad compatibility fallback, but uploaded files are unverified evidence and do not auto-issue rewards.
- Do not make Apple Watch ownership a prerequisite for participating. Users on supported Android devices and other approved ecosystems should be able to use the same bot flow.

### Trust boundary

HealthKit/Health Connect access is stronger provenance than an arbitrary file upload, but it is not absolute proof that a person physically ran. Records may be written by third-party apps, imported, or manipulated. The verifier must inspect source/device metadata, activity type, timestamps, distance/duration, route availability and anomalies; classify the assurance level; and issue rewards only according to a documented policy. Do not describe this as tamper-proof or biometric proof.

The repository contains Capacitor 8 iOS and Android shells. The iOS shell is the native host for the HealthKit bridge; Telegram Mini App and PWA remain browser-only entry points and cannot access HealthKit directly. The first native increment reads running workouts and returns a normalized, device-reported summary to JavaScript. This is provenance evidence, not server-verifiable attestation: it must not be marked `verified` or issue rewards until a server-verifiable device/app attestation flow is implemented. The server-side GPX intake now persists `verification_state='unverified'` and cannot issue rewards.

## Provider-neutral mobile summary contract

Both native adapters normalize into the same required field set:

- `id`, `activityType='running'`
- `startedAt`, `endedAt` as UTC ISO-8601 timestamps
- `durationSeconds` as a positive integer, at most 14,400
- `distanceMeters` as a non-negative integer, at most 250,000
- `sourcePlatform`, `sourceName`, `sourcePackageName`
- `deviceName`, `deviceModel`, `sourceProductType`
- `evidenceState='device_reported'`

Identifiers are non-empty and capped at 255 characters; display/provenance labels are capped at 120 characters. Both adapters reject malformed time ranges, non-running activities, invalid numeric values and missing source identifiers. The iOS bundle identifier is mapped to the shared `sourcePackageName` field; no platform-specific alias is exposed to callers. Android additionally supplies the optional `recordingMethod` signal (`actively_recorded`, `automatically_recorded`, `manual_entry`, `unknown`). This signal does not change evidence trust.

Both adapters default to and cap requests at 30 days and return at most 25 running records. To avoid letting non-running workouts consume the result limit, each adapter scans a bounded window of at most 500 source records (Health Connect: up to five 100-record pages; HealthKit: one 500-record query). These are display/query limits, not verification guarantees. The normalized summary can now be submitted to `POST /api/fitness/evidence` using the authenticated guest session. The server stores a minimal provider-neutral record with `verification_state='unverified'`; no route, coordinates or raw provider payload are retained. The endpoint derives a customer+platform+provider-record hash server-side for idempotency. This ingestion endpoint does not verify that the native adapter is genuine and does not issue rewards.

## Recommended rollout

1. Define a stable server-side evidence contract and source trust levels independent of Apple/Android. The provider-neutral intake endpoint is implemented and stores device summaries as unverified; it cannot issue a reward.
2. Implement the iOS HealthKit bridge for Apple Watch workouts, with explicit permission UX and minimal data transfer. Initial read-only bridge is present; native build/device verification remains outstanding.
3. Keep Telegram as the onboarding, status, and reward-code interface.
4. Android Health Connect read-only bridge, profile permission flow and common server evidence intake are implemented; native build/device verification and cryptographic/source verification remain outstanding.
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

The server issues one-time challenges bound to the authenticated verified guest and purpose. Challenges expire after five minutes, are SHA-256 hashed at rest, consumed atomically, and limited to ten per guest per rolling minute. Consumed and expired rows must remain until their creation timestamp exits the rate-limit window; deleting them immediately would let a caller consume challenges to evade the limit.

The challenge endpoint is still only a primitive: it does not validate Apple's attestation certificate chain/assertions, persist an attested public key or counter, or verify HealthKit summary provenance. Assertion challenges must ultimately bind to a registered key and to a canonical request digest, not merely to the account and purpose.

### Apple App Attest server contract (not yet implemented)

The verifier must run server-side on the pinned Node.js 22 runtime. It must reject malformed/oversized CBOR and DER inputs; validate the x5c certificate path to Apple's App Attest root; validate nonce extension OID 1.2.840.113635.100.8.2 over authData concatenated with SHA-256(server challenge); match the X9.62 uncompressed credential public-key hash to the key ID; verify RP ID hash against the configured App ID (TeamID.BundleID); require the initial counter to be zero; enforce the configured development/production AAGUID; check credential ID equals key ID; and apply Apple's validation-category and bundle-version policy. Persist only the extracted public key, key identifier, environment/policy metadata, and last assertion counter. Reject key reuse across Zerno accounts.

Each assertion must be verified using the registered public key: compute clientDataHash from a server-defined canonical payload containing the one-time challenge and exact request digest; hash authenticatorData concatenated with clientDataHash; verify the ECDSA signature; check RP ID and validation extensions; require a strictly increasing counter; and consume the challenge plus advance the counter in one immediate SQLite transaction. Bind an evidence submission's canonical digest to that assertion so a valid assertion cannot be replayed for another activity. App Attest validates app-instance/request provenance only; it does not prove that a human physically ran.

### Android Key Attestation and Play Integrity (not yet implemented)

These are separate signals and must not be conflated. For Key Attestation, the Android client generates a signing key with a server challenge and sends the X.509 chain to the trusted backend. Validation must happen off-device: verify every chain signature to an accepted Google attestation root; check current revocation status and expiry/root-rotation data; parse the first trusted attestation extension (it is unsafe to assume it resides in the leaf); match challenge; verify the attestation security level is TEE or StrongBox; validate attestation application ID/package and signing certificate digest; inspect OS/vendor/boot patch levels and RootOfTrust; require a locked device and Verified boot state for the configured assurance policy; then persist the public key and monotonic signature counter. Key registration and request signatures must bind account, exact body digest, and one-time server challenge. Fail closed when root status/revocation data is stale or unavailable.

The official Android Key Attestation verifier is a Kotlin library, not a Node.js package. Evaluate it as an isolated trusted verification service/JVM module or a carefully reviewed Node ASN.1/X.509 implementation; do not port only the happy path. Track the Google root set and revocation status as live security inputs. Play Integrity Standard can provide a complementary request/app/device verdict (including requestHash binding), but is not a substitute for Key Attestation public-key registration and signature verification. Do not make the Android client self-assert a verdict.

Neither Android Key Attestation nor Play Integrity establishes that Health Connect data were authored by the actual wearer or that the person physically ran. Health Connect record origin, recording method, and possible third-party/import paths remain separate provenance signals.

### Verification and rewards gate

Until all source-specific checks, canonical-request binding, replay protection, key lifecycle/revocation handling, and native-device validation are implemented and tested, fitness_device_evidence.verification_state must remain unverified (or a non-rewardable review state). The client must never choose the state. No RUN reward issuance, Strava-derived eligibility, or production feature flag change is in scope.
