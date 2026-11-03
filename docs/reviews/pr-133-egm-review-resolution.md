# EGM Review Resolution — PR #133

Pull request: https://github.com/h0wller/zerno-app/pull/133
Branch: `feat/pizza-native-variant-radios`
Reviewed HEAD: `bfb9808e9d00e90e1b41d8fec54da73391ac4a26`
Base: `pizza` (`4bd2fd3ad19bdcd6a060e080100e72302923814e`)

## Review mode and limits

This is a same-context EGM review and resolution, not an independent Goldfish review. The host did not expose an isolated subagent, and Graphify reported no automated review for PR #133. Graphify's code graph was indexed at the base commit, so it was not treated as current-head evidence. Source claims below were checked against the PR branch files and diff.

## Review summary

- Blocker: 0
- High: 1
- Medium: 2
- Low: 3
- No implementation changes were made as part of review/resolution.

## Disposition ledger

### EGM-133-01 — High — ACCEPTED / OPEN

**Topic:** Conflicting CSS architecture contracts.

**Evidence:**
- `PROJECT_RULES.md`, section 2, defines a three-layer CSS model and says inline styles in `public/index.html` are allowed only for FOUC prevention and first-frame logo CLS.
- `docs/css-architecture.md`, sections “4 слоя” and “СЛОЙ 4”, defines a four-layer model and explicitly forbids component styles in `index.html`.
- `docs/module-map.md`, section 13, also documents four layers and identifies `index.html` as the critical layer.
- PR #133 places the full native pizza option component styling (fieldset layout, label geometry, palette, checked state, focus, and validation) in `public/index.html`.

**Impact:** Engineers and reviewers cannot determine a single authoritative placement rule for component styles. This affects architecture compliance and future CSS ownership, but does not alone prove a user-visible runtime defect.

**Decision:** Keep open. The four-layer contract has broader support in architecture documentation, but the repository does not contain a verified ADR or explicit decision superseding the mandatory three-layer section in `PROJECT_RULES.md`. Do not silently rewrite the normative rules or accept the PR's CSS placement until that decision is confirmed.

**Blocks implementation?** Blocks architectural sign-off of the inline component CSS, not the native-radio behavior itself.

### EGM-133-02 — Medium — ACCEPTED RISK

**Topic:** Missing validation lifecycle regression test after card rerender.

**Evidence:** `resolveDeliveryAddSelection()` adds `aria-describedby` to the first radio and shows an inline error. `updateFirstDeliveryCard()` replaces the first card's `.cbody.innerHTML`, removing the old radio and error nodes. The review did not establish a stale reference defect because both referenced nodes are removed together.

**Impact:** A future change to card reconciliation could preserve or reattach only part of the validation state without a test catching it.

**Decision:** Treat as a test coverage gap, not a confirmed defect. Retain the current behavior. Add a test for “missing choice → first-card rerender → attempt add again” when the delivery card rendering lifecycle is next changed.

**Blocks implementation?** No.

### EGM-133-03 — Medium — ACCEPTED

**Topic:** Duplicate checked-state and focus styling across CSS owners.

**Evidence:**
- Checked option styling exists in `public/app/ui/theme/160-09-preorder-subfilters.css`.
- Matching delivery-brand checked styling is emitted in `public/app/core/views.js`.
- A further first-frame copy exists in `public/index.html`.
- Focus outline is applied to both `.opt-radio:focus-visible + .opt-content` and `.opt-btn:has(.opt-radio:focus-visible)` in the theme CSS; the early HTML rules repeat both targets in one selector list.

**Impact:** Multiple sources can drift independently. Both focus targets may draw separate outlines around nested regions.

**Decision:** Accept the simplification: select one source of truth for checked-state within the chosen CSS architecture and render exactly one visible focus outline. Keep critical first-frame rules only to the extent explicitly allowed by the resolved architecture contract.

**Blocks implementation?** Non-blocking for radio functionality; should be cleaned up before calling the CSS implementation final.

### EGM-133-04 — Low — CONTESTED / CONTEXT-DEPENDENT

**Topic:** Sanitized product IDs could collide when used in radio group names and IDs.

**Evidence:** `renderPizzaOptsHtml()` maps every character outside `[a-zA-Z0-9_-]` to `-`. Distinct arbitrary strings can therefore collide. The available review evidence did not establish the production type/constraint of product IDs; an assumed server file path was not present, and no matching code search result verified the database contract.

**Impact:** If nonnumeric IDs containing different punctuation are permitted, two product groups could share a radio name or element ID. If the production ID is a unique integer, the collision scenario is not applicable.

**Decision:** Do not change code based on an unverified input domain. Verify the actual `dmenu` ID contract/schema first. If IDs are guaranteed unique integers, close as not applicable; otherwise replace the sanitizer with a collision-free encoding or stable unique identifier.

**Blocks implementation?** No, pending contract verification.

### EGM-133-05 — Low — ACCEPTED RISK

**Topic:** Checkout radio reset has no dedicated E2E assertion.

**Evidence:** After successful checkout, `public/app/cart.js` clears all checked delivery option radios. The new test suite does not exercise the successful-checkout-to-cleared-radio path. The user previously performed a manual check, but that is not an automated regression test.

**Impact:** A future checkout refactor could leave stale selection visible after an order is submitted.

**Decision:** Retain the implementation. Add automated coverage when checkout flow tests are next extended; no current functional defect is established.

**Blocks implementation?** No.

### EGM-133-06 — Low — ACCEPTED / OPEN

**Topic:** Dispatcher render revision guard lacks an overlap-order regression test.

**Evidence:** `renderOrders()` increments a revision before requesting `/orders`, and checks the revision after the request resolves and before rendering; its catch path also suppresses errors from superseded calls. This prevents an older overlapping request from overwriting newer state. The changed test verifies duplicate cancellation controls but not overlapping render completion order.

**Impact:** Removing or weakening the guard could reintroduce stale list rendering under concurrent refreshes.

**Decision:** Keep the revision guard; it is justified concurrency protection, not over-engineering. Add a deferred-response Playwright test if dispatcher refresh concurrency is changed or this code is refactored.

**Blocks implementation?** No.

## Cross-document consistency check

The four-layer model appears in both `docs/css-architecture.md` and `docs/module-map.md`; the three-layer model remains in `PROJECT_RULES.md`. Graphify returned only an unverified agent-note about the alleged supersession of the old contract. That note was not treated as an authoritative architecture decision.

No design document for native pizza variant selection was found at the expected `docs/designs/pizza-variant-selection-*` paths. Consequently, no finding relies on an unavailable design brief or presumed prohibition of `:has()`.

## Verification status

At the latest check of CI run #1665 (`41717746253`):
- Code Quality & Guardrails: success.
- Client bundle build: success.
- Bonus Lifecycle E2E: success.
- Bonus Signup Regression: success.
- Remaining Playwright tests: still in progress.

No full CI pass is claimed. No tests were run locally as part of this review.

## Final recommendation

Keep PR #133 Draft. The main functional implementation has targeted tests for accessible radio groups, independent selection, keyboard operation, validation, and cart payload compatibility. Before final architectural approval, resolve EGM-133-01 and remove the duplicated CSS state/focus rules from EGM-133-03. Leave the context-dependent ID concern open until the actual server/data contract is inspected.
