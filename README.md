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
8. `docs/openapi.yaml` — API contract (verify route implementation before assuming every operation is current).

## Project commands

See root `package.json` for canonical script definitions:
- `npm run pretest`
- `npm run audit`
- `npm run build:client`
- `npm run test:e2e`

The CI workflow is `.github/workflows/ci.yml`; deployment is `.github/workflows/deploy.yml`.

## Documentation maintenance

- Update module ownership in `docs/module-map.md` in the same PR as ownership changes.
- Update architecture docs with source code when ownership/cascade rules change.
- Historical audits remain historical; do not rewrite past outcomes as current facts.
- Put current UX findings in `docs/frontend-todo.md` and acceptance/screenshot evidence in `docs/ui-checklist.md`.
- Every current test statement must reference a commit and CI run; old test counts are historical.
