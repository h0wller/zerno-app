# Documentation audit — Zerno App

**Reviewed branch:** `pizza`  
**Reviewed commit:** `401fa8fe727854249dbd4f93e990f768eb579255`  
**Date:** 2026-11-07  
**Purpose:** reconcile documentation statements with the repository state. Historical evidence remains historical. This audit does not claim that every operational or domain document has been re-verified.

## Executive verdict

The previous 2026-11-05 register is superseded. The highest-confidence drift items have been corrected in this documentation update:

- stack, build, cache-bump, audit-script and deploy descriptions now match `package.json`, `server.js` and workflow files;
- guardrails describe six checks, four classic scripts, actual CI triggers and the current ESLint warning limit;
- `docs/api.md` is treated as a route/guard index, not as a historical draft;
- `docs/openapi.yaml` now includes the six missing production operations and removes the duplicate `/api/redeem` path and duplicate `403` response key;
- UX roadmap status reflects merged #177/#167 and draft #179/#182;
- `docs/` is the only maintained documentation source; the Mintlify/Context7 `docs7/` mirror is retired from navigation.

## 1. Visual UX feedback and PR status

| Item | Current status on `pizza` | Documentation treatment |
|---|---|---|
| Profile hint, promo one-line action, coffee social links, profile dismissal backdrop | #177 merged as `401fa8f` | Marked complete |
| Mobile support launcher placement and collision avoidance | #167 merged as `52083e2` | Marked complete |
| Checkout recipient block | #179 open, draft | Kept active; preserve existing order API contract |
| Staff mode switcher / edit control placement | #182 open, draft | Described as proposed behavior, not completed |
| iOS safe-area top strip | No implementation PR recorded | Remains open pending real iOS evidence |

The #178 draft is stale relative to #177 and #167. Its former proposed sequence incorrectly scheduled already-merged work. The current staff-controls proposal follows #182: in guest menu mode, `#modeSeg` and the single permitted `#editToggle` sit in the menu-title row; in cashier/dispatch/admin modes, `#modeSeg` returns to the topbar and `#editToggle` returns to `#adminBar`. This is a draft implementation direction, not a merged UX acceptance. The old #178 requirement that edit always remain in the admin rail is no longer the active proposal.

## 2. Stack, build, audit and deployment

Verified against `package.json`, `server.js`, `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`:

- Node engine: 22.x; package type: ESM.
- Express dependency: `^5.3.0`; ESLint: `^10.13.0`.
- Telegram calls use Node's global `fetch`; `node-fetch` is not a declared dependency.
- `build:client` runs `bump:sw` before esbuild.
- `lint:code` uses `--max-warnings 50`.
- `audit` runs check, pretest, code/duplication/dead-code/layer lint, contract smoke tests and E2E.
- `pretest` includes client syntax/bundle checks, CSS audit, brands-check, observer audit and unit/integration tests.
- CI triggers on every `pull_request` (no target-branch filter) and pushes to `main` or `pizza`.
- Deploy follows a successful `CI Quality Gates` run on `pizza` or can be manually dispatched. The server workflow installs dependencies, builds the client with `BUILD_NUM`, prunes dev dependencies, reloads PM2 and checks process status.

The deployment workflow does **not** use `npm ci --omit=dev` as its install command and does not rely on a prebuilt local client bundle.

## 3. Guardrails

- Six configured quality checks are listed in `docs/guardrails.md`.
- Four classic scripts are explicitly listed in `public/index.html` and documented; the old count of five was incorrect.
- The ESLint budget is currently 50 warnings, not 60. The 200 → 100 → 0 budget and four-PR rollout are historical and are labelled accordingly.
- The 2026-10-01 warning counts, technical-debt line numbers and orphan candidates are historical measurements, not current source findings.

## 4. API reference and OpenAPI

### Route index

`docs/api.md` is the concise method/path/guard index. The audit input reports 77 of 77 production routes matching code by method, path and guard. The current edits correct the literal escaped newlines in the guard list and describe `POST /api/staff/stamp` as stamp accrual only.

The test-only `POST /__test/otp` is not a production route.

### OpenAPI changes

The previous spec had 72 operations but only 71 unique operations because `POST /api/redeem` was duplicated. The update adds the six omitted production operations:

- `POST /api/menu`
- `PUT /api/menu/reorder`
- `PUT /api/menu/{id}`
- `DELETE /api/menu/{id}`
- `POST /api/menu/upload`
- `POST /api/tg/webhook`

It also corrects the `GET /api/menu/all` summary to show `menuGuard` roles (cashier, dispatch, admin) and removes the duplicate `403` key under `GET /api/tg/diag`.

**Scope limitation:** this is a route/guard and structural OpenAPI reconciliation. Full request/response schema equivalence, every error response, content types, webhook Telegram Update schema and generated-client compatibility have not yet been proven. Treat the OpenAPI file as improved, not as fully contract-tested.

## 5. docs7 policy

`docs/` is the sole source of truth. `docs7/` is a deprecated imported Mintlify/Context7 snapshot with no generator or CI synchronization. To prevent stale pages being served as authoritative, the Mintlify navigation is reduced to a retirement notice linking to canonical `docs/` files. Do not manually maintain duplicate copies in `docs7/`.

## 6. README inventory

The README index now includes the API route index, OpenAPI, guardrails, operational runbooks, notes, nutrition estimates, promotion/review records, UX audits, performance report and all three workflows. Temporary Firecrawl screenshot URLs were removed from the index; durable evidence belongs in GitHub Actions artifacts and the scorecard register.

## 7. Not re-verified in this pass

The following remain outside the scope of this reconciliation and must not be represented as fully audited:

- `PROJECT_RULES.md`;
- `docs/module-map.md` versus current ESM imports and DOM mutation ownership;
- `docs/css-architecture.md`, `docs/css-tech-debt.md`, `docs/ui-checklist.md`;
- `docs/testing/slow-network-layout.md` versus current Playwright assertions/artifacts;
- bonus-grants and network-incident runbooks;
- nutrition estimates, promotion rules and review records;
- ADRs and `perf-report.md` source calculations;
- complete OpenAPI schemas and Postman import/client generation.

Operational infrastructure facts such as public server IP, current DNS/proxy configuration and production secret values were not independently checked. Never copy CI test PINs into production configuration; verify production `.env` out of band. The default employee PIN values in `server/config.js` are development fallbacks, not production secrets.

## 8. Verification performed

- Read source files from the named `pizza` ref through the GitHub repository API.
- Compared package scripts, CI triggers and deploy commands with the documentation.
- Inspected the server's menu handlers, Telegram webhook handler and staff stamp handler.
- Checked the relevant PR metadata and merge commits for #167, #177, #179 and #182.
- No application code, database, production environment or live deployment was changed.
- No local test suite or CI workflow was run as part of this documentation-only reconciliation.

## Remaining order of work

1. Review and merge this documentation reconciliation PR after its documentation checks.
2. Finish #179 and #182 separately; do not mix UI changes into the docs PR.
3. Capture and inspect the iOS safe-area issue on actual iOS PWA screenshots before opening a fix PR.
4. Perform a schema-level OpenAPI review and validate Postman/OpenAPI import with strict duplicate-key parsing.
5. Reconcile `docs/module-map.md` with current import and DOM ownership evidence.
