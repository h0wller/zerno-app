# API contract guard — F-003 invariant matrix

Baseline: `pizza@9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78`  
Audit evidence: [F-003 report](https://github.com/h0wller/zerno-app/blob/audit/openapi-contract-2026-11-26/docs/audits/openapi-contract-audit-2026-11-26.md)

This matrix is deliberately **not a second route registry**. Route/method inventory is extracted from Express registrations at test time. The sentinels below pin known F-003 observations until an implementation PR resolves an individual finding and deliberately updates/removes its sentinel. They do not change the OpenAPI contract and do not declare the current known mismatches correct.

| F-003 invariant | Machine check | Current baseline treatment | Residual/manual check |
|---|---|---|---|
| C-01 `Customer.id` | Source ID generator marker plus OpenAPI schema type | Baseline sentinel: server uses prefixed string ID; schema remains integer | Runtime response scalar type |
| C-02 `MenuItem.id` | Source ID generator marker plus OpenAPI schema type | Baseline sentinel: server uses prefixed string ID; schema remains integer | Runtime response scalar type |
| C-03 consent | Handler predicate plus OpenAPI type/enum | Baseline sentinel: handler accepts `1/true`; schema remains integer `[0,1]` | Full input coercion/validation behavior |
| C-04 SMS/Telegram registration | SMS branch marker plus Telegram response required fields | Baseline sentinel: both branches remain visible as known mismatch | Live SMS provider response |
| C-08 QR pattern | QR generator marker plus OpenAPI length constraints | Baseline sentinel: source emits `Z-` plus six uppercase hex chars; schema keeps 16–64 | Full QR scan flow and DB response |
| C-10 order status | OpenAPI type/enum fingerprint | Baseline sentinel: schema string remains without enum | Verify exact status map against all server transitions |
| C-09 delay minutes | Server range expression plus OpenAPI min/max fingerprint | Baseline sentinel: server accepts integer 1–180; schema minimum remains 0 and maximum absent | Runtime coercion for strings/fractions |
| C-11 promo info | Handler 200-false branch plus documented 404 | Baseline sentinel: known response mismatch remains recorded | Every promo state (expired, exhausted, scope) |
| C-12 promo creation | Handler body access plus absence of OpenAPI requestBody | Baseline sentinel: missing request schema remains recorded | Complete validation/error matrix |
| C-15 chat botlog | Handler metadata-write marker plus documented 409 | Baseline sentinel: known response semantics mismatch remains recorded | Race ordering under concurrent requests |
| C-14 push subscription | Handler endpoint requirement plus OpenAPI nested required list | Baseline sentinel: schema still does not require endpoint | Full Web Push subscription validation |
| C-17 role guards | BearerAuth presence on representative admin/stats/dispatch operations | Machine-checks authentication scheme presence only | Role-specific permissions and brand isolation remain manual |

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

When a dedicated implementation PR resolves a known F-003 finding, update the corresponding sentinel in that PR so the guard moves from pinning the old audited state to asserting the corrected invariant. Do not change the OpenAPI file in the guard-only PR.
