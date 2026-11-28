# API contract guard — F-003 invariant matrix

Baseline: `pizza@b380024159e838582088e58d42d30e828eaf8ab9`  
Audit evidence: [F-003 report](https://github.com/h0wller/zerno-app/blob/audit/openapi-contract-2026-11-26/docs/audits/openapi-contract-audit-2026-11-26.md)

This matrix is deliberately **not a second route registry**. Route/method inventory is extracted from Express registrations at test time. The sentinels below pin audited contract invariants. The status table records what the current automated checks establish on the exact `pizza` baseline; a PASS does not imply complete OpenAPI equivalence.

| F-003 invariant | Current automated result on `pizza@736e9d8` | Residual/manual check |
|---|---|---|
| C-01 `Customer.id` | **PASS** — server generates a prefixed string ID; OpenAPI type is `string` | Runtime response scalar type |
| C-02 `MenuItem.id` | **PASS** — server generates a prefixed string ID; OpenAPI type is `string` | Runtime response scalar type |
| C-03 consent | **PASS** — handler accepts only `1` or `true`; OpenAPI documents both variants | Full input coercion/validation behavior |
| C-04 SMS/Telegram registration | **PASS** — SMS branch and Telegram response variant are represented in the contract | Live SMS provider response |
| C-08 QR pattern | **PASS** — generated `Z-` plus six uppercase hex characters matches the exact OpenAPI pattern | Full QR scan flow and DB response |
| C-10 order status | **PASS** — OpenAPI enum matches the accepted server status set | Verify exact map against every server transition |
| C-09 delay minutes | **PASS** — required integer `min` is constrained to 1–180 in both handler and OpenAPI | Runtime coercion for strings/fractions |
| C-11 promo info | **PASS** — HTTP 200 documents both error and success payload variants; stale 404 is absent | Every promo state (expired, exhausted, scope) |
| C-12 promo creation | **PASS** — OpenAPI documents the request body and fields consumed by the handler | Complete validation/error matrix |
| C-15 chat botlog | **PASS** — source upserts thread metadata; OpenAPI documents automatic creation without stale 409 | Race ordering under concurrent requests |
| C-14 push subscription | **PASS** — handler requires a string endpoint; OpenAPI marks it required | Full Web Push subscription validation |
| C-17 role guards | **PASS (representative)** — guard markers and BearerAuth are present for the audited admin/stats/dispatch operations | Full route-by-route permissions and brand isolation |

**Verification note (2026-11-28):** `pizza@b380024159e838582088e58d42d30e828eaf8ab9` differs from the previously checked `pizza@736e9d87d5f67a4ba55e2d3b49d7b04114cdbc72` only by the test-only merge of PR #368; server routes, OpenAPI and production code are unchanged. The source-equivalent Code Quality & Guardrails run [46140677552](https://github.com/h0wller/zerno-app/actions/runs/46140677552) reported 79 production routes, 79 OpenAPI operations and 12 F-003 sentinels, with no diagnostics. This establishes the listed machine-checkable invariants only; it does not establish full schema equivalence or replace the residual checks below.

## Automated checks

- AST-based extraction from `server.js` and every `server/routes/*.js`.
- Literal and simple constant route paths; Express `:param` normalized to OpenAPI `{param}`.
- Test-only `/__test/*` routes excluded.
- Dynamic/unresolved route paths are reported rather than silently omitted.
- Strict YAML parsing with duplicate mapping key rejection using the already-installed `yaml` package.
- Production route inventory parity (missing and extra operations).
- Duplicate server registrations and duplicate OpenAPI operations.
- Baseline sentinels above produce actionable diagnostics with file, method/path, expected and actual values.

## Explicit limitations

The guard does not infer all Express middleware semantics, runtime status codes, response payloads, nullable fields, external provider behavior or arbitrary JavaScript data flow. It does not prove complete OpenAPI schema equivalence. Those checks require targeted integration tests, contract-specific invariants and/or runtime verification.

When an implementation PR changes one of these invariants, update the corresponding sentinel and its regression fixture in that PR. Keep the sentinel focused on the proven invariant; do not use it as a substitute for broader request/response contract tests.
