# Audit reconciliation — 2026-11-23

**Historical source snapshot:** `b043180903f14b09461c2d7689554b17e250733c`  
**Current production source at reconciliation:** `27635e625610434c8a6a4c26a29d0388abc9589f`  
**Purpose:** distinguish findings observed in the supplied external audit from subsequent fixes and outstanding work. This is a source reconciliation, not production security certification or exhaustive visual acceptance.

## Current release state

- PR #311 (SQLite backup, deploy health check and best-effort code rollback) was merged to `pizza` at `27635e625610434c8a6a4c26a29d0388abc9589f`.
- Production workflow [Deploy to Timeweb #4894](https://github.com/h0wller/zerno-app/actions/runs/45265137355) completed successfully for that exact SHA on 2026-11-23 at 21:00:43 UTC. The SSH deployment step, PM2 reload and workflow health gate all reported success.
- The deploy script creates and verifies a SQLite online backup before PM2 reload, but its health endpoint is a process-readiness check, not a database/migration readiness check. The rollback restores code/dependencies/build only, never the DB snapshot; this avoids discarding new orders.
- Post-merge CI [run #4893](https://github.com/h0wller/zerno-app/actions/runs/45265107345) is running independently of the deployment. At the time this file was updated, Code Quality and several E2E jobs had completed successfully; remaining E2E groups were still running. Re-check the run before treating the merge SHA as fully CI-green.
- The workflow remains in-place on `/var/www/app`; it is not an atomic/staged release. A future failed rollback or dependency install may still require manual VPS recovery.
- VPS PM2/.env/DB-path facts refer only to the inspected deployment configuration and are not universal defaults.

## Confirmed implemented protections — do not duplicate

### Server-side order idempotency

- `POST /api/orders` accepts optional `client_order_id`, validates `[A-Za-z0-9_-]{8,128}`, fingerprints canonical request JSON excluding the key, checks same-key replay before mutable validation and repeats the lookup inside a SQLite `BEGIN IMMEDIATE` transaction.
- A partial unique index on `(cid, client_order_id)` covers non-null keys.
- Replays do not re-consume promos, reallocate order numbers or re-send notifications. A changed payload under the same key returns HTTP 409 / `IDEMPOTENCY_KEY_REUSED`.
- Existing resolution record: `docs/reviews/order-idempotency-egm-resolution.md`.
- **Follow-up:** PR #315 aligns `docs/openapi.yaml` and `docs/api.md` with this implementation. Its current branch still requires a fresh CI run on the latest head and a full-spec validation/import result. Fragment validation is not a substitute for full specification validation.
- **Residual risk:** notifications remain post-commit and are not protected by a transactional outbox. A crash after DB commit and before sending can lose a notification; do not claim exactly-once delivery.

### Chat rate-limit storage

- Guest chat applies the IP-level limit before thread authorization.
- Per-thread limits are applied only after verifying the owner or anonymous capability.
- Keys are hashed; rows expire after seven days; the SQLite table is capped transactionally at 20,000 rows.
- When full, the route rejects new identities with HTTP 503 / `CHAT_RATE_LIMIT_STORAGE_FULL`.
- Current implementation: `server/routes/chat.js`. Do not create per-thread buckets before authorization or reintroduce raw guest thread keys.

### Role/session and frontend observations

- The inspected `public/app/core/auth-session.js` did not contain the stale timer/observer cascade alleged in the supplied audit.
- The inspected `public/app/core/dash-orders.js` and `public/app/core/menu-content.js` contained no `setInterval` polling timer. Those specific audit claims were not reproduced.
- `public/app/ui/category-rail.js` coalesces scroll work with `requestAnimationFrame` and uses bounded fallback timers for fade/programmatic-scroll completion. This is not an unconditional polling loop.
- Do not change these modules based only on stale symbol names.

## Follow-up PR status at current production SHA

- **PR #313 — client log and menu upload hardening:** implementation and tests are in its branch. Do not merge/deploy until production `TRUST_PROXY` is inspected against the actual Nginx proxy chain. With the flag unset Express may see one proxy IP for all clients. The limiter is in-memory and per Node process, not a shared multi-worker quota.
- **PR #314 — bounded Service Worker media cache:** FIFO cap of 300, activation trim, serialized writes, and offline fallback tests are implemented. CI run #4856 passed all 13 applicable jobs for the exact PR head; Lighthouse was skipped by workflow condition. The offline behavior is covered in deterministic Service Worker tests. However, the project's visual/field acceptance gate still requires an isolated guest PWA/device check of offline media eviction and fallback. Do not infer real-device acceptance from unit tests or server-side HTML scraping.
- **PR #315 — OpenAPI order idempotency:** documents the existing server behavior. The validator and YAML were corrected after an earlier CI failure, but a new successful run for the current head and full OpenAPI/Postman import-readback are still needed.
- **PR #317 — delivery search event contract:** CI passed, but visual acceptance is explicitly not accepted because no genuine base-branch before/after capture was obtained. Do not merge until that comparison and remaining role/viewport checks in `PROJECT_RULES.md §10` are completed.
- **PR #318 (this reconciliation):** documentation-only. This document's historical findings are pinned to the source SHA above; current deployment/PR statuses are separate and must be refreshed if their state changes.

## Historical findings on source commit `b043180903f14b09461c2d7689554b17e250733c`

The findings below are immutable observations on that snapshot. They do not imply that the issue remains open on current `pizza`.

### Security / server

1. **Public client log endpoint:** `POST /api/clientlog` in `server.js` was public, wrote to stdout and inherited a large global JSON body limit. The later PR #313 adds a 4 KiB route limit, IP rate limiting and bounded in-memory key storage; its production proxy configuration remains the outstanding gate.
2. **Image upload resource bounds:** `POST /api/menu/upload` was admin-guarded but decoded Base64 before route-specific payload bounds and Sharp processing checks. PR #313 adds encoded/decoded limits, strict formats, metadata/pixel checks and isolated integration tests; the production proxy setting remains the separate gate.
3. **Media cache retention:** `public/sw.js` wrote image/SVG responses without a retention cap. PR #314 adds a FIFO 300-entry cap, activation trimming and serialized writes without trimming static/API caches.
4. **OpenAPI drift:** the historical base spec omitted `client_order_id` and order conflict/validation responses. PR #315 covers the order idempotency part. Clientlog schema documentation is a separate remaining contract task and is not included in PR #315.

### Client performance / correctness

1. **Delivery search:** the historical `public/app/ui/delivery-search.js` iterated cards and used repeated `DMENU.find()` lookups and wrapped global `renderDeliveryMenu`. PR #317 moves this to the existing `ztBus` event contract and a per-filter-call index. It still needs the explicitly documented visual acceptance.
2. **Order reordering:** the historical `public/app/core/order-reorder.js` searched the menu for each restored order item and parsed option payloads repeatedly. PR #316 introduces one index per restoration and regression tests for duplicates/options; it is merged in `pizza`.
3. **Nutrition calculation:** the inspected resolver falls back from ID/name lookup to a case-insensitive scan of `techCards`. Memoization was not justified without profiling and invalidation semantics; no speculative cache was recommended.

### Native iOS

- The historical `ios/App/App/Info.plist` listed `armv7` in `UIRequiredDeviceCapabilities`. Validate actual supported deployment/build/archive targets before changing the supported ABI. Static inspection alone is insufficient.

## Findings not confirmed / stale

- Timer/polling claims for `dash-orders.js` and `menu-content.js` were not reproduced from the inspected source.
- The alleged auth-session observer/timer cascade was not present in the inspected source.
- Audit percentages, severity scores and estimated counts are not treated as measurements without the underlying reproducible run/artifact.
- Existing order idempotency and chat rate-limit protection must not be duplicated.

## Required verification for follow-up work

- Server hardening: `npm run pretest`, focused integration tests, `npm run smoke`, and full CI. Include invalid, oversized and capacity/abuse cases.
- Service Worker: deterministic tests for cache cap, activation trim, offline hit/miss and preserving static/API caches; real-device offline acceptance remains separate.
- Frontend refactor: obtain baseline before changes; compare both brands, mobile portrait/landscape including short landscape, desktop and affected roles; inspect each screenshot plus DOM/computed geometry/focus/safe-area/hit targets.
- iOS: build/archive on supported Xcode targets and device/simulator matrix.
- OpenAPI: strict duplicate-key YAML parse, compare auth/body/status/error behavior to routes, run Redocly and full Postman spec import/readback.
- Visual changes remain gated by `PROJECT_RULES.md §10`; CI screenshots without actual review do not constitute visual acceptance.

## Source and review provenance

- Sources used: `AGENTS.md`, `PROJECT_RULES.md`, `docs/read-if-u-ai.md`, `docs/module-map.md`, `docs/css-architecture.md`, `docs/frontend-todo.md`, `docs/api.md`, `docs/openapi.yaml`, `docs/documentation-audit-2026-11-07.md`, and the source on historical `b043180` plus current `pizza`.
- Graphify index: `b043180903f14b09461c2d7689554b17e250733c`. Findings were checked against live GitHub files; no new independent Graphify PR review was available.
- Ponytail review principle: keep fixes scoped and avoid broad rewrites. This documentation PR makes no runtime change.
- No application source, database, production configuration or deployment was changed by this document.
