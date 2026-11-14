# Fitness evidence verification — technical decision

Status: proposed implementation contract for PR #252
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
