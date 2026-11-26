# Zerno App — technical cleanup & bug-hunt register

**Audit baseline:** `pizza` at `9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78` (2026-11-26).
**Audit branch:** `chore/full-technical-audit-cleanup`.
**Status:** evidence collection in progress; this document is not a claim that the full audit is complete.

## Scope and evidence rules

This register distinguishes:
- **Confirmed** — reproduced in source, configuration, or exact-head CI metadata.
- **Coverage gap** — required evidence is missing; not automatically a product defect.
- **Candidate** — needs deeper source tracing or runtime reproduction before a code change.
- **Accepted guardrail** — intentional behavior that cleanup must preserve.

No production data, secrets, live customer sessions, or deployment configuration were modified or inspected. No local Node/npm/Playwright run was performed from this session. GitHub source/API inspection and CI metadata are the evidence used below.

## Findings

### F-001 — Mobile performance baseline is not executed on this base commit
- **Priority:** P2 (measurement/verification gap; not a demonstrated runtime regression).
- **Evidence:** check run `45877938249` on exact baseline SHA has `Lighthouse / Mobile LCP comparison = skipped`.
- **Location:** `.github/workflows/ci.yml` Lighthouse job condition; job check `140110030937`.
- **Actual:** normal quality/E2E run provides no LCP/FCP/CLS/TBT comparison for this commit.
- **Expected:** a reproducible mobile performance result against a matched base/head build when performance is in scope.
- **Impact:** changes to initial load cannot be accepted/rejected from exact-head performance evidence alone.
- **Disposition:** keep a dedicated matched Lighthouse workflow/job; do not infer a performance win from older PR #300/#308 snapshots.
- **Regression/verification:** run the configured Lighthouse job on a PR head eligible under the workflow condition; archive JSON and record device/network/cache/brand plus repetitions.

### F-002 — Production and physical-device acceptance remains incomplete
- **Priority:** P2 (coverage gap).
- **Evidence:** `docs/frontend-todo.md` lists production guest baseline + cart/checkout/profile, staff sessions and real iOS/Telegram acceptance as open; `docs/css-architecture.md` requires role/brand/viewport review.
- **Actual:** exact-base CI includes local test-server visual capture and Mobile Chrome responsive checks, not production visual proof or real iOS/Telegram device behavior.
- **Expected:** production evidence separated from CI fixtures; native iOS PWA and Telegram Mini App gesture/safe-area acceptance where relevant.
- **Impact:** CI passing does not establish production media/config parity or WebKit/TMA behavior.
- **Disposition:** record as an acceptance gate; no speculative CSS/DOM changes.
- **Regression/verification:** same-source production capture and device/browser matrix; inspect each required frame per PROJECT_RULES §10.

### F-003 — API/OpenAPI schema equivalence is not established
- **Priority:** P2 (contract coverage gap).
- **Evidence:** `docs/documentation-audit-2026-11-07.md` explicitly limits the prior OpenAPI reconciliation to route/guard and structural comparison; `docs/frontend-todo.md` says request/response details still require schema-level verification.
- **Location:** `docs/openapi.yaml`, `docs/api.md`, `server/routes/*.js`, integration tests.
- **Actual:** route index is a concise method/path/guard map; full request/response, error, content-type and external webhook schema equivalence has not been proven by this evidence.
- **Expected:** strict YAML parse with duplicate-key rejection and per-route request/response/guard comparison against executable route definitions and integration tests.
- **Impact:** generated clients and external consumers may rely on incorrect or incomplete schemas.
- **Disposition:** separate contract-reconciliation PR; do not mutate API behavior during cleanup.
- **Regression/verification:** duplicate-key parser, operation uniqueness check, Postman/OpenAPI import where a relevant workspace is configured, and contract tests for changed routes.

### F-004 — Dynamic ownership contracts make static dead-code deletion unsafe without corroboration
- **Priority:** P3 (process/maintainability risk).
- **Evidence:** `docs/module-map.md` lists public `window.*` contracts, runtime DOM owners, event-bus contracts, inline first-frame bridges, and statically ordered imports; PROJECT_RULES §9 requires Graphify plus real imports before deletion.
- **Actual:** a pure ESM unused-export scan can miss dynamic `window.*` consumers, HTML inline bridges, event names, delegated selectors and test harnesses.
- **Expected:** dead-code candidates are proven unused across static imports, HTML, selectors, event bus, scripts, tests, build entry points and Graphify impact.
- **Impact:** careless removal can silently break runtime flows or ownership boundaries.
- **Disposition:** no cleanup deletion solely based on grep/Knip/Graphify absence. Treat Knip output as a candidate list.
- **Regression/verification:** record consumer search and impact for each removed symbol; run existing pretest, lint:dead, lint:layers and focused E2E.

### F-005 — Staff/customer lookup currently loads the full customer table before matching
- **Priority:** P3 (scaling/performance candidate; not yet measured as a user-visible defect).
- **Evidence:** `server/routes/staff.js` GET `/api/staff/customers` performs `SELECT * FROM customers` then filters in JS; exact phone lookup and ambiguity handling are subsequently applied in memory.
- **Actual:** each staff search reads all customer rows, including full customer records, before filtering; no LIMIT/index-backed lookup is used in this handler.
- **Expected:** equivalent exact/partial phone/name matching and ambiguous-match behavior with bounded DB work and minimal selected columns.
- **Impact:** lookup cost grows with customer count; potential unnecessary data materialization in the Node process.
- **Disposition:** candidate for isolated measured optimization, not a drive-by query rewrite. Preserve complete exact duplicate results and the partial-search five-result cap unless a contract change is approved.
- **Regression/verification:** add RED tests for full phone, partial phone, name, duplicate ambiguity and case-insensitive matching; compare query plan and latency at representative fixture sizes; verify staff guard and response shape.

### F-006 — Existing order idempotency and server pricing are critical invariants, not cleanup targets
- **Priority:** accepted guardrail.
- **Evidence:** `server/routes/orders.js` validates optional `client_order_id`, hashes normalized request payload, checks replay before mutable menu/slot validation and repeats lookup inside the write transaction; prices/modifiers are loaded from DB.
- **Actual:** server-side idempotency, replay conflict response and server-derived pricing are intentional protections.
- **Expected:** duplicate retries must not create duplicate orders; reusing a key with a changed payload must conflict; client-supplied prices are never authoritative.
- **Disposition:** preserve. Any future adjustment starts with concurrency/replay tests and transaction review.
- **Regression/verification:** existing order integration/E2E plus parallel same-key POST tests; DB uniqueness/transaction race check.

### F-007 — Loyalty mutations must remain server-side and transactionally protected
- **Priority:** accepted guardrail.
- **Evidence:** `server/routes/staff.js` routes stamp and redeem through domain functions `grant`/`redeem` behind `staffGuard`; cashier customer creation uses `db.transaction(...).immediate()` and returns conflict on ambiguous normalized phone matches.
- **Actual:** balance/stamp/redeem authority resides on the server; duplicate phone ambiguity is explicitly blocked.
- **Expected:** client cannot set balance, stamps or gifts; concurrent redeems cannot spend the same gift twice.
- **Disposition:** preserve and test; do not consolidate route/domain code without tracing transactions and consumers.
- **Regression/verification:** domain + integration tests for concurrent stamp/redeem, no balance tampering, customer ownership and staff role matrix.

### F-008 — Authorization boundaries are explicit and must not be collapsed
- **Priority:** accepted guardrail.
- **Evidence:** `server/middleware/auth.js` resolves only bearer tokens with a non-expired `expires_at`; `staffGuard`, `adminGuard`, `menuGuard`, `dispatchGuard` have distinct role sets; `verifiedCustomerGuard` separately enforces guest verification while allowing staff.
- **Actual:** the guards are intentionally not interchangeable.
- **Expected:** 401 unauthenticated, 403 wrong role, expired sessions rejected; routes use the narrowest guard.
- **Disposition:** preserve; review route-by-route rather than replacing guards wholesale.
- **Regression/verification:** API tests for token expiry, guest/staff/admin/dispatch matrix and resource ownership.

## Baseline CI evidence — run 45877938249, SHA 9e0007a

### Passed (13 jobs)
- Code Quality & Guardrails
- E2E / Mobile Chrome responsive
- E2E / Visual UX capture
- E2E / Visual stability
- E2E / Auth
- E2E / PWA
- E2E / Bonuses
- E2E / UI baseline
- E2E / Cart and checkout
- E2E / Staff API
- E2E / Profile
- E2E / Menu and search
- E2E / Responsive UI

### Skipped (2 jobs)
- Lighthouse / Mobile LCP comparison — workflow condition not met.
- E2E / Auth registration baseline (pizza 7330120) — workflow condition not met (specific PR #345).

### Failed
- None in this run.

Step-level skips also occurred in matrix jobs because each group runs only its own requested spec list; they are not failed tests. Exact skipped steps should not be counted as test execution:
- In Visual stability, auth-modal/registration step skipped; Auth group ran and passed separately.
- Other role-specific matrix groups skipped nonmatching test steps.
- The deterministic bonus clock step ran only in Bonuses.

## Tooling and repository state

- Root scripts include `npm run audit`, `pretest`, `lint:code`, `lint:dup`, `lint:dead`, `lint:layers`, `smoke`, `test:e2e`, `build:client`.
- No local command was run in this environment; this register does not claim a fresh npm audit/build.
- Current open PRs at audit start: #339 (Knip bump), #338 (dependency-cruiser bump), #252 (fitness), #203 (design baseline). Avoid overlap with their files and scope.
- Context7 reviewed Express 5 validation and trust-proxy documentation only; no production settings were inferred from it.
- Postman project workspace/collection binding was not identified; no Postman collection was created and no remote contract run is claimed.
- No production DB, secret, user session or runtime server inspection was performed.

## Next work packages (separate PRs where independent)

1. **P2 measured DB lookup optimization** — F-005 only, after fixture-based RED test and query plan/latency evidence.
2. **P2 OpenAPI reconciliation** — F-003 only; strict parser, API route contract parity and duplicate operations.
3. **P2 production/native acceptance** — F-002; capture and inspect real production/device evidence, no code cleanup until defect confirmed.
4. **P2 performance baseline** — F-001; run matched Lighthouse on a PR eligible for the workflow.
5. **P3 dead-code/duplication cleanup** — after an executable full local audit and cross-reference of Graphify + real runtime contracts.

## Explicitly not done

- No code, CSS, DOM, API, database or dependency deletion/change.
- No npm dependency updates.
- No baseline snapshot update.
- No merge, draft change, or deployment.
- No production access or data mutation.
