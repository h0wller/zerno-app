# EGM Review Resolution — PR #133

Pull request: https://github.com/h0wller/zerno-app/pull/133
Branch: `feat/pizza-native-variant-radios`
Initial reviewed HEAD: `bfb9808e9d00e90e1b41d8fec54da73391ac4a26`
Resolution commits: see PR branch history.
Base: `pizza` (`4bd2fd3ad19bdcd6a060e080100e72302923814e`)

## Review mode and limits

This remains a same-context EGM review and resolution, not an independent Goldfish review. The host did not expose an isolated subagent, and Graphify reported no automated review for PR #133. Graphify's promoted code graph was indexed at the base commit, so it was not treated as current-head evidence. Current source claims were verified through GitHub files and commits.

## Review summary

- Blocker: 0
- High: 1 (resolved)
- Medium: 2 (one accepted risk, one resolved)
- Low: 3 (one resolved, two accepted risks)
- Runtime logic/CSS changes applied only for accepted findings.
- CI run #1674 failed on the reviewed HEAD; diagnosis and test-only corrections are tracked below. A fresh CI run is required.

## Disposition ledger

### EGM-133-01 — High — RESOLVED

**Topic:** Conflicting CSS architecture contracts.

**Evidence:** The old three-layer statement in `PROJECT_RULES.md` conflicted with `docs/css-architecture.md` and `docs/module-map.md`.

**Resolution evidence:** Repository history confirms the four-layer model was already introduced in commit `0acb316c37ecf1231169e34048af652c1400f6d0` on 2026-09-19, whose message explicitly says “document 4-layer architecture”. Commit `f233964dec2ca9207e43ffb4587dae8bd7ebe5ea` on 2026-10-02 explicitly refers to `docs/css-architecture.md (4-слойная схема)`. This predates PR #133 and establishes that the 3-layer section in PROJECT_RULES was stale.

**Change:** Replaced the stale section in `PROJECT_RULES.md` with the four logical layers, clarified that 2a/2b are sublayers rather than extra top-level layers, and linked the detailed architecture and ownership documents.

**Disposition:** Resolved. The architecture itself was not newly invented for this PR; the stale normative summary was corrected to match the existing repository contract.

### EGM-133-02 — Medium — ACCEPTED RISK

**Topic:** Missing validation lifecycle regression test after card rerender.

**Evidence:** `resolveDeliveryAddSelection()` attaches `aria-describedby` to the first radio and exposes the inline error. `updateFirstDeliveryCard()` replaces the card's `.cbody.innerHTML`, removing the old radio and error nodes together. No stale-reference defect was established.

**Impact:** Future changes to card reconciliation could preserve only part of the validation state without an automated test detecting it.

**Disposition:** Accepted risk / test coverage gap. Do not add a complex test fixture solely for this path unless card rerender behavior changes. Existing validation tests remain.

**Blocks implementation?** No.

### EGM-133-03 — Medium — RESOLVED

**Topic:** Duplicate checked-state and focus styling across CSS owners.

**Evidence:** Checked-state CSS existed in theme CSS, `views.js`, and critical CSS. Focus was outlined on both the input's adjacent content and its parent label.

**Changes:**
- Removed the duplicate radio-specific checked-state rules from `views.js`.
- Kept checked-state visual behavior in the theme component stylesheet.
- Reduced focus styling to one `:focus-within` outline on the option label.
- Reduced the early `index.html` radio CSS to geometry-only reservation; removed palette, checked-state, typography, and validation styling from the early copy.

**Disposition:** Resolved at source level. Visual verification remains part of CI/browser validation; do not claim visual acceptance before the run completes.

**Blocks implementation?** No, pending CI.

### EGM-133-04 — Low — RESOLVED

**Topic:** Product IDs could collide after lossy sanitization.

**Evidence:** `server/db/schema.js` declares `menu.id TEXT PRIMARY KEY`; `server/db/seed.js` uses string IDs such as `pz-marg`. The database does not enforce an alphanumeric-only contract. Replacing all non-`[a-zA-Z0-9_-]` characters with `-` could therefore map distinct IDs to the same radio group name.

**Change:** `renderPizzaOptsHtml()` now encodes the UTF-8 bytes of the complete ID as lowercase hexadecimal. This is reversible and collision-free for distinct strings, while leaving cart `data-id`, `data-oi` and item key semantics unchanged.

**Test:** Added a Playwright regression using IDs `pizza/one` and `pizza?one`, which collide under the old lossy replacement. The test now exercises the same UTF-8/hex naming expression and verifies two separately selectable groups in the DOM.

**Disposition:** Source fix is resolved. CI #1674 exposed an indirect test that manually recreated the encoding instead of invoking the production renderer; that test is being replaced with a regression against the generated markup.

### EGM-133-05 — Low — ACCEPTED RISK

**Topic:** Checkout radio reset lacks dedicated E2E coverage.

**Evidence:** `public/app/cart.js` clears all checked delivery radios after successful checkout. The new radio suite does not drive an actual successful checkout through that path. The user previously performed a manual check, but that is not an automated regression test.

**Disposition:** Accepted risk. Keep implementation. Add end-to-end checkout coverage when checkout lifecycle tests are next extended.

**Blocks implementation?** No.

### EGM-133-06 — Low — ACCEPTED RISK

**Topic:** Dispatcher render revision guard lacks an overlap-order regression test.

**Evidence:** `renderOrders()` increments a revision before requesting `/orders`, checks it after the request resolves and suppresses stale errors. This prevents older overlapping requests from overwriting newer state.

**Disposition:** Accepted risk / coverage gap. Keep the guard; it is justified concurrency protection. Add a deferred-response test if dispatcher refresh concurrency is changed or refactored.

**Blocks implementation?** No.

## Cross-document consistency

The four-layer model is represented in `docs/css-architecture.md`, `docs/module-map.md`, repository history from 2026-09-19 onward, and now `PROJECT_RULES.md`. A Graphify candidate note was not used as authoritative evidence.

No feature-specific design document was found at the expected `docs/designs/pizza-variant-selection-*` paths. No finding relies on presumed design constraints from those missing files.

## Verification status

The prior run #1666 had Quality Gates successful while the Playwright Regression Suite was still running. Later resolution commits changed the branch again, so that run is not verification of the final resolution HEAD.

CI run #1674 (HEAD `dd72eaac166046b7824469cdab0a91bb854c021b`) completed with:
- Code Quality & Guardrails: passed.
- Playwright Regression Suite: failed in four configurations, all in `tests/pizza-variant-selection.spec.js`.
- 429 Playwright tests passed; 4 failed; 9 skipped.

Failure triage:
- The validation test expected the old pre-hex ID `pizza-option-pz-radio-test-error`; the production DOM correctly emitted `pizza-option-707a2d726164696f2d74657374-error`. Test expectation corrected to read the current error ID from the rendered node.
- Keyboard test incorrectly assumed `ArrowDown` from the second item in a native radio group would move to visual grid index 3. CSS grid position does not change native radio keyboard order. The regression now checks left/right traversal and checked state instead of imposing visual-grid semantics.
- The same validation test asserted DOM focus on an almost-zero-sized, transparent radio input; the product styling intentionally exposes focus via the containing label's `:focus-within`. Test now verifies the accessible description link and visible focus outline.

No application runtime code change is made for these four CI failures: evidence points to incorrect test assumptions rather than a confirmed production defect.

No local tests are claimed. A fresh CI run is required for the updated test and ledger.

## Final recommendation

Keep PR #133 Draft until current-head CI completes. Findings 01, 03 and 04 have source-level resolutions; findings 02, 05 and 06 remain accepted, explicitly bounded coverage risks. Do not merge based only on the earlier successful static audit.
