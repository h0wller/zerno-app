# Audit reconciliation — 2026-11-23

**Audited source branch:** `pizza`  
**Source commit (Graphify index):** `b043180903f14b09461c2d7689554b17e250733c`  
**Purpose:** reconcile the external audit with current source and repository rules. This is a source review, not production security certification or visual acceptance.

## Deployment decision — PR #311

**Do not deploy from the current `pizza` branch yet.**

- PR #311 adds backup/verification, serialized deploy execution, best-effort code rollback and a local HTTP health probe.
- The production-target `pizza` deploy workflow at the audited source still uses in-place `git reset --hard`, `npm install --package-lock-only`, `npm ci`, build/prune and PM2 reload. It has no database backup, no service health gate and no rollback.
- The deploy-safe workflow exists only on PR #311's branch until that PR is merged.
- Its new health check targets `GET /api/health`, which currently returns `{ok:true}` without checking database readiness or migration completion. `migrateBase64ImagesToWebP()` starts in the `app.listen()` callback, so the listener can answer before this migration completes.
- The rollback restores code/dependencies/build only, not the SQLite database. Automatic DB restore is intentionally not included because it could discard orders written after the backup.
- CI run #4844 for documentation commit `e44d67cd596de017d5d1385e0b9019e3e633468d` was checked during this audit: all reported jobs except `E2E / Mobile Chrome responsive` had completed successfully at last observation; that job was still running. Lighthouse was skipped by current workflow conditions. Re-check the run before any merge/deploy.
- VPS facts (PM2 cwd `/var/www/app`, process command loads `/var/www/app/.env`, PM2 DB_PATH absent, resolved DB `/var/www/data/zerno.db`) came from production diagnostics previously supplied in this project conversation. They are not universal defaults.

## Confirmed already implemented — do not duplicate

### Server-side order idempotency

- `POST /api/orders` accepts optional `client_order_id`, validates `[A-Za-z0-9_-]{8,128}`, fingerprints canonical request JSON (excluding the key), checks same-key replay before mutable validations and repeats the lookup inside a SQLite `BEGIN IMMEDIATE` transaction.
- Unique partial index `(cid, client_order_id)` is installed for non-null values.
- Replays do not re-run promo consumption, order-number allocation, or notifications.
- Different request payload under the same key returns HTTP 409 / `IDEMPOTENCY_KEY_REUSED`.
- Existing resolution record: `docs/reviews/order-idempotency-egm-resolution.md`.
- **Remaining:** `docs/openapi.yaml` has not been reconciled with this contract: its `POST /api/orders` request schema omits `client_order_id` and the 400/409 response contract. This is documentation drift, not a missing server feature.
- **Residual risk:** notifications are post-commit and not a transactional outbox; crash after DB commit and before notification can lose the notification. Do not claim exactly-once external delivery.

### Chat rate-limit storage abuse

- Guest chat applies the IP-level rate limit before thread authorization.
- Per-thread rate limits are applied only after successful owner/capability authorization.
- Keys are hashed; rate-limit rows expire after seven days; global row count is transactionally capped at 20,000.
- When full, the route rejects new identities with HTTP 503 / `CHAT_RATE_LIMIT_STORAGE_FULL`.
- Current code is in `server/routes/chat.js`. Do not reintroduce raw guest thread keys or create per-thread buckets before authorization.

### Role/session and frontend status observations

- Current `public/app/core/auth-session.js` did not contain the stale timer/observer cascade alleged in the supplied audit.
- `public/app/core/dash-orders.js` and `public/app/core/menu-content.js` contain no `setInterval`/polling timer in the inspected source. Claims that those files run an interval-based order poll were not reproduced.
- `public/app/ui/category-rail.js` uses scroll events coalesced with `requestAnimationFrame`, plus bounded fallback timers for visual fade/programmatic scroll completion. This is not an unconditional polling loop.
- Do not change these modules based solely on stale symbol names from the audit.

## Confirmed findings requiring follow-up

### Security / server

1. **Public client log endpoint:** `POST /api/clientlog` in `server.js` is public and writes to stdout. Fields are truncated to 40/300 characters, and the global JSON parser allows up to 10 MB. No route-specific IP rate limit was found. Add bounded rate limiting and a smaller route-specific body contract, with tests; keep the endpoint public only if anonymous client diagnostics remain required.
2. **Image upload resource bounds:** `POST /api/menu/upload` is guarded by `adminGuard`, but Base64 data is decoded before any route-specific payload-size check. Four Sharp pipelines then process the buffer. Add encoded/decoded byte caps, strict accepted media formats, metadata validation and an explicit pixel ceiling before launching the pipelines. Keep Sharp's default input safety features enabled. Test malformed, oversized, unsupported and valid image inputs.
3. **Media cache retention:** `public/sw.js` writes image/SVG requests to `MEDIA_CACHE` without an entry-count/byte-size eviction policy. Old cache versions are deleted on activate, but the current media cache has no bound. Implement a deterministic FIFO/LRU bound without evicting the static app shell or API cache; cover it with Service Worker tests and preserve offline behavior.
4. **OpenAPI drift:** `docs/openapi.yaml` does not list `client_order_id` and the conflict/validation responses for order creation. The client-log schema requires `kind` and `msg`, while the implementation supplies defaults for absent fields. Reconcile schemas and error responses with routes and tests; run strict YAML duplicate-key parsing and Postman import validation.

### Client performance / correctness

1. **Delivery search:** `public/app/ui/delivery-search.js` loops over cards and calls `DMENU.find()` for each card; `comp` JSON strings may be parsed on each filter; filtering executes for every input event; module wraps global `renderDeliveryMenu`. Replace with one prepared lookup/index and explicit event/ownership contract (per `docs/module-map.md` / `PROJECT_RULES.md`), debounce only if UX latency is measured, and add focused search tests. Do not preserve the global monkey patch as a new pattern.
2. **Order reordering:** `public/app/core/order-reorder.js` maps historical items and calls `products.find()` per item, parsing options repeatedly. Build lookup maps once per operation and test duplicate IDs, malformed options, selected option index, and legacy fallback behavior.
3. **Nutrition calculation:** current `nutrition.js` resolves by id/name before a case-insensitive scan of `techCards`; memoization is not yet justified without profiling and clear invalidation semantics. Profile first; do not add a permanent cache speculatively.

### Native iOS

- `ios/App/App/Info.plist` currently lists `armv7` under `UIRequiredDeviceCapabilities`. Validate the actual supported deployment/build matrix and archive settings before changing this to `arm64`. This is a separate native-build PR; do not change plist on the strength of static inspection alone.

## Findings not confirmed / stale

- Audit claims about interval polling in `dash-orders.js` and `menu-content.js` were not reproduced from current `pizza`.
- The current auth-session source does not show the described observer/timer cascade.
- Do not treat audit percentages, estimated severity scores, or counts from an excerpted report as measured facts unless the underlying run/artifact is available and reproducible.
- Existing order idempotency and chat rate-limit protections are already implemented (see above); don't reopen duplicate work.

## Required verification per future PR

- Server hardening: `npm run pretest`, relevant integration tests, `npm run smoke`, full CI; include negative and capacity/abuse cases.
- Service Worker: deterministic tests for cache bound, stale-version cleanup, offline hit/miss and no eviction of app shell/API cache.
- Frontend refactor: baseline screenshots before change; both brands, mobile portrait/landscape, desktop; targeted Playwright and full CI; inspect actual artifacts and DOM/CSS ownership.
- iOS: build/archive on supported Xcode targets and device/simulator matrix.
- OpenAPI: strict duplicate-key YAML parse, compare route/auth/status/body/error semantics, import into Postman and record exact specification/version/result.
- Visual changes remain gated by `PROJECT_RULES.md §10`; CI screenshots without human inspection are not visual acceptance.

## Tool/review provenance

- Sources: `AGENTS.md`, `PROJECT_RULES.md`, `docs/read-if-u-ai.md`, `docs/module-map.md`, `docs/css-architecture.md`, `docs/frontend-todo.md`, `docs/api.md`, `docs/openapi.yaml`, `docs/documentation-audit-2026-11-07.md`, current server/client source on `pizza`.
- Context7 verified the installed Sharp 0.35.5 `metadata()` and `limitInputPixels` API.
- Graphify index commit: `b043180903f14b09461c2d7689554b17e250733c`; Graphify retrieval was corroborated against live GitHub files. Graphify independent PR review was not run in this pass.
- Ponytail guidance was used as a review constraint: avoid broad rewrites; preserve behavior; test each focused change. No code change is claimed from that skill.
- Postman API operations were inspected but no workspace/collection or runtime request was created; import validation remains open.
- No application source, database, production configuration, or deployment was changed by this reconciliation.
