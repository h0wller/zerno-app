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
- Medium: 3 (two source-level resolutions, one accepted server-side idempotency risk)
- Low: 3 (one resolved, two accepted coverage risks)
- CI #1679 passed on the pre-follow-up HEAD; the synchronous checkout-lock correction and regression test are tracked below and require fresh CI.

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

**Disposition:** Source fix is resolved. The initially indirect test was replaced by a regression that observes names from the production renderer; the first run of that replacement exposed stale fixture group-count and second-card selectors, now corrected. Full CI for the final state is pending.

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


### EGM-133-07 — Medium — RESOLVED

**Topic:** Checkout submission remained unlocked during asynchronous validation.

**Evidence:** `checkBtn.onclick` awaited `resolveCheckoutInput()` before calling `showCheckoutProgress()`. `resolveSlot()` can await delivery-info refresh, leaving the checkout control and Telegram MainButton path able to initiate another handler while the first request is pending.

**Impact:** Two clicks in the validation window could create parallel `POST /api/orders` requests and duplicate real orders.

**Change:** Added a closure-level `checkoutInProgress` lock before the first await. The disabled/busy UI and Telegram MainButton progress now start synchronously; the lock and UI are restored in `finally`, including invalid-input early returns and API errors.

**Regression:** Extended the Telegram checkout flow to hold `/api/delivery/info` during validation, invoke the registered native MainButton callback again, and assert that no POST occurs until validation is released and exactly one order POST follows.

**Disposition:** Resolved at source level. Current-head CI must pass before merge.

### EGM-133-08 — Medium — ACCEPTED RISK

**Topic:** Server-side order idempotency key is not implemented.

**Evidence:** The client generates `client_order_id` and calls it an idempotency key, but the `orders` table has no corresponding column/unique constraint and `POST /api/orders` neither reads nor persists the key. The local checkout lock prevents simultaneous submissions from the same live page, but cannot deduplicate a retry after an ambiguous network timeout, reload, or a second client.

**Impact:** Retrying an order after an uncertain response can still create a second order. This requires a deliberate server/database idempotency contract and migration strategy.

**Disposition:** Accepted follow-up risk; do not describe `client_order_id` as effective server-side idempotency until the server persists and enforces it. Track separately from the native radio UI PR.

**Blocks this PR?** No, provided the client-side concurrent-click regression passes; this PR does not claim to implement server-side retry idempotency.

## Cross-document consistency

The four-layer model is represented in `docs/css-architecture.md`, `docs/module-map.md`, repository history from 2026-09-19 onward, and now `PROJECT_RULES.md`. A Graphify candidate note was not used as authoritative evidence.

No feature-specific design document was found at the expected `docs/designs/pizza-variant-selection-*` paths. No finding relies on presumed design constraints from those missing files.


## Follow-up CI #1679 — final pre-concurrency-fix HEAD

CI #1679 (HEAD `7f4262b248a5b6cfefb0d37395fd3bc23452bba6`) completed successfully:
- Code Quality & Guardrails: passed.
- Playwright Regression Suite: passed.

This run did not include EGM-133-07. The latest branch adds the synchronous checkout lock and its Telegram MainButton regression. A new run for that HEAD is required before merge.

## Current verification target

- Source HEAD: `750676a2c1c33da5877321a52250e46ec3b964bd`.
- `public/app/cart.js`: checkout lock is acquired before async validation and released in `finally`.
- `tests/cart-regress.spec.js`: delayed validation + second native MainButton invocation must yield exactly one order POST.
- No local tests are claimed. CI on this exact HEAD is pending.

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

## Follow-up CI #1677 — 2026-11-03

CI #1677 (source HEAD `edd727ffd24bb7f195974a425bdf927acc2f2df4`) completed with:
- Code Quality & Guardrails: passed.
- Playwright Regression Suite: failed; 430 passed, 4 failed, 1 flaky, 9 skipped.
- The two deterministic failures repeated across Chromium and Mobile Chrome because the suite expected 2 native radio groups after adding a third fixture product; corrected to expect 3.
- The other two deterministic failures repeated across Chromium and Mobile Chrome because keyboard independence still selected the removed product ID `pz-radio-test-second`; corrected to use `pizza?one`.
- `auth-modal-ux.spec.js` had one flaky landscape-phone viewport assertion. Diagnostic context shows the registration button is inside an internally scrollable card (`overflow-y:auto`), while the test asserts full viewport intersection after `scrollIntoViewIfNeeded()`. This is unrelated to pizza radio selection and was not modified without a stable reproduced failure.

The current branch corrects the two deterministic test defects. No application runtime changes were made for CI #1677 failures. A new CI run is required before merge.

## Final recommendation

Do not merge until CI passes on current source HEAD `750676a2c1c33da5877321a52250e46ec3b964bd`. Findings 01, 03, 04 and 07 have source-level resolutions; findings 02, 05, 06 and 08 remain explicitly bounded coverage/idempotency risks. Independent Goldfish review was unavailable; this is a same-context EGM review.


## Follow-up CI #1681 — 2026-11-03

CI #1681 ran on source HEAD `61779b8bc04c4638cd7b61920872fc43521c18ed`:
- Code Quality & Guardrails: passed.
- Bonus Lifecycle E2E: passed.
- Bonus Signup Regression: passed.
- Remaining Playwright Tests: failed; 433 passed, 2 failed, 9 skipped.

Both failures were the same existing TMA checkout/Live Tracking test in Chromium and Mobile Chrome. Trace inspection showed the test timed out at its new concurrency section: the initial MainButton re-click correctly hit the disabled checkout button, but the test did not subscribe to the order response before releasing its delayed validation route. The test harness could then miss the fast response / continue against a still-transitioning form. The regression now:
- asserts the checkout button is disabled during the held validation request;
- registers `waitForResponse` before releasing the request;
- releases validation, awaits a successful `POST /api/orders`, asserts exactly one POST and that the button is enabled again.

This is a test synchronization correction. No product source change is made in response to #1681. Fresh CI is required for the updated regression at the current HEAD.
