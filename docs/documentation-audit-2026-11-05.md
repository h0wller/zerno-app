# Documentation audit register — Zerno

**Reviewed against:** `pizza` at `216abe2bca4b79982af2ddf470dee00db00360be`
**Date:** 2026-11-05
**Purpose:** show which source documents were inspected and whether their current content was changed. This is not a claim that every historical statement in every document has been re-proven.

## Updated in this PR
- `PROJECT_RULES.md` — contradictory CSS ownership guidance and stale hard-coded engineering rules reconciled.
- `docs/css-architecture.md` — logical layers, layer ownership, cascade review and responsive acceptance rewritten.
- `docs/css-tech-debt.md` — old three-layer/`theme-v2.css` debt report reframed as historical; no unverified old defect kept as current.
- `docs/ui-checklist.md` — replaced pre-refactor smoke list with current guest/staff/responsive/screenshot acceptance requirements.
- `docs/frontend-todo.md` — active client-first UX audit queue; removed stale current E2E count and contradictory preorder status.
- `docs/notes.md` — removed duplicate active preorder feature request; marked implemented.
- `README.md` — documentation index and preliminary production screenshot references.

## Inspected; retained as source/history pending deeper cross-check
- `docs/read-if-u-ai.md` — contains stale stack facts (the text says Express 4.x; current package manifest must be used as the canonical dependency source) and operational context requiring selective maintenance. Not rewritten here because a reliable full infrastructure inventory needs server and deployment verification.
- `docs/api.md` — explicitly draft v0.1 and includes uncertain endpoints; must be reconciled route-by-route before promoting to canonical.
- `docs/openapi.yaml` — identifies server route handlers as source of truth; requires automated diff against current server route schemas before being declared complete.
- `docs/module-map.md`, `public/app/README.md` — ownership index references retained; broader current source-to-doc graph verification is still required.
- `docs/guardrails.md` — checked against package scripts/CI as needed; not comprehensively rewritten.
- `docs/testing/slow-network-layout.md` — retained as the detailed slow-network contract; should be checked against current Playwright spec/CI artifact.
- `docs/bonus-grants-runbook.md`, `docs/network-incident-runbook.md`, `docs/promotions/weekday-lunch-discount.md`, `docs/nutrition-estimates.md` — domain/runbook docs inspected at heading/summary level; no behavioral edits made without full route/data verification.
- `docs/postmortem-2026-10-09-db-migration.md`, `docs/telegram-notification-investigation-2026-10-29.md`, `docs/audits/*`, `docs/reviews/*` — historical evidence and review records; preserved as historical, not rewritten to retroactively imply new verification.

## Findings requiring follow-up
1. Full API contract drift check: `docs/api.md`, `docs/openapi.yaml`, `server/routes/*`, tests.
2. Stack/infrastructure drift check: `docs/read-if-u-ai.md`, `package.json`, lockfile, `server.js`, `.github/workflows/*`.
3. Module ownership drift check: `docs/module-map.md`, ESM imports, DOM mutation points, Graphify refreshed to current HEAD.
4. Live visual baseline: isolated guest contexts for both brands and separately authenticated staff roles; record viewport/commit/screenshot.
5. Historical accessibility audit is delivery-only and does not cover coffee/staff, so it is not a full site accessibility sign-off.

## Evidence discipline

A source file is marked "inspected" only when fetched from the named branch. Historical audit findings remain historical unless reproduced on the current commit. Scrape output from an unknown browser authentication state is preliminary evidence only.
