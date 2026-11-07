# Zerno App — documentation index

Dual-brand PWA / Telegram Mini App for «…и кофе» and «Пятница».

## Start here

1. `PROJECT_RULES.md` — mandatory engineering guardrails.
2. `docs/read-if-u-ai.md` — system, stack, deployment and project context.
3. `docs/module-map.md` — canonical DOM/module ownership map.
4. `docs/css-architecture.md` — CSS responsibility layers and cascade rules.
5. `docs/frontend-todo.md` — current frontend/UX audit queue and roadmap.
6. `docs/ui-checklist.md` — UI acceptance and screenshot protocol.
7. `docs/testing/slow-network-layout.md` — first-paint/CLS regression contract.
8. `docs/api.md` — concise production route and guard index.
9. `docs/openapi.yaml` — OpenAPI contract; schemas still require route-level review before treating it as exhaustive.
10. `docs/guardrails.md` — current CI quality gates and thresholds.
11. `docs/bonus-grants-runbook.md` and `docs/network-incident-runbook.md` — operational runbooks.
12. `docs/notes.md` and `docs/nutrition-estimates.md` — product/technical notes.
13. `docs/promotions/` and `docs/reviews/` — promotion specifications and engineering review records.
14. `docs/audits/` — UX scorecard and audit evidence.
15. `perf-report.md` — performance report.
16. `docs/documentation-audit-2026-11-07.md` — current documentation reconciliation; the 2026-11-05 register is historical.

## Project commands

See root `package.json` for canonical script definitions:
- `npm run pretest`
- `npm run audit`
- `npm run build:client`
- `npm run test:e2e`

The CI workflow is `.github/workflows/ci.yml`; deployment is `.github/workflows/deploy.yml`; the manual read-only production screenshot workflow is `.github/workflows/visual-ux-baseline.yml`.

## Documentation maintenance

- Update module ownership in `docs/module-map.md` in the same PR as ownership changes.
- Update architecture docs with source code when ownership/cascade rules change.
- Historical audits remain historical; do not rewrite past outcomes as current facts.
- Put current UX findings in `docs/frontend-todo.md` and acceptance/screenshot evidence in `docs/ui-checklist.md`.
- Every current test statement must reference a commit and CI run; old test counts are historical.

## Visual UX evidence

The 2026-11-05 Firecrawl screenshots were preliminary, had no isolated guest auth state, and were stored at temporary object URLs. Those URLs are intentionally not repeated here as durable evidence. Use the named artifacts from GitHub Actions:
- `Visual UX Baseline` for the manual read-only production capture;
- `CI Quality Gates` → `E2E / Visual UX capture` for deterministic test-server captures.

Every screenshot finding must record source, commit, brand, role, viewport and state. Test-server artifacts are not production approval. See `docs/audits/visual-ux-scorecard.md`.


## Documentation source of truth

`docs/` is the canonical maintained documentation tree. `docs7/` is a deprecated Mintlify/Context7 snapshot and is intentionally not maintained in parallel; its navigation is reduced to a notice directing readers to the canonical files in `docs/`. Do not cite `docs7/` pages as current project facts.
