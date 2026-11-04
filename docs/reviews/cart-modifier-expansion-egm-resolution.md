# EGM Review Resolution — Cart modifier expansion state

## Scope
Preserve the expanded modifier panel for a cart row when another row before it is removed. This PR changes only client-side cart state and its regression coverage.

## Source evidence
- `public/app/cart.js`: `openModsMap` stores expansion state by current cart array index.
- `renderCartItemRow()` reads `openModsMap[itemIndex]`.
- `handleCartModifiersToggleClick()` writes the current row index.
- Both quantity decrement and quick-addon removal can remove a cart row with `splice()`.
- `docs/module-map.md` assigns cart mutations and persistence to `cart.js`; no new owner or public API is introduced.

## Disposition ledger

### EGM-CART-01 — Medium — RESOLVED
**Finding:** Removing an item before an expanded row leaves the remaining `openModsMap` keys unchanged. The expanded row shifts to a lower array index, so its panel collapses on rerender.

**Change:** Added one local `removeCartItemAt(index)` helper. It removes the cart row and shifts only expansion-state keys after the removed index down by one; earlier keys remain unchanged. Both row quantity removal and quick-addon removal use this helper.

**Acceptance:** A Playwright regression adds two separate delivery items, expands modifiers on the second row, removes the first, and asserts that the remaining row still renders the expanded modifier chips and the “Скрыть добавки” control.

**Scope limits:** Does not change cart item identity, cart persistence format, pricing, server contracts or modifier selection semantics.

### EGM-CART-02 — Low — ACCEPTED COVERAGE RISK
**Finding:** The new regression covers the standard quantity-minus removal route. The quick-addon removal route is wired to the same helper but has no dedicated interaction-level regression in this PR.

**Disposition:** Accept for this small fix because both routes call the exact same removal helper; add a dedicated quick-addon UI scenario if quick-addon row removal changes independently.

## Review mode and limitations
This is a same-context EGM review and resolution, not an independent Goldfish review. No isolated reviewer was available. Graphify's promoted graph is indexed at the base commit and is used only as navigation evidence; source claims were checked against the branch files.

## Verification
- CI #1689: Code Quality & Guardrails and Playwright Regression Suite passed on source HEAD `afabb42c4fc8f9e11f505b809bd033c09aa10744` before retargeting to the merged #133 base. The new branch carries the regression on top of #133's merged native radio implementation; CI must pass again on this stacked HEAD.
- No local tests are claimed.


## Follow-up CI #1682 — 2026-11-03

CI #1682 ran on source HEAD `5533a66cb6f6f220d104a5d5f39bb5a0d62da914`:
- Code Quality & Guardrails: passed.
- Playwright Regression Suite: failed; 411 passed, 2 failed, 9 skipped.
- The new cart expansion regression timed out locating `[data-toggle-mods]` on the second cart row. The rendered cart row had no modifier-toggle section because the CI menu data contained no active pizza topping. `renderItemAddModSection()` intentionally returns an empty string when the active topping list is empty.
- The test now seeds one active, test-only cheddar topping in `window.DMENU` before adding its two pizzas, making the modifier UI precondition explicit and deterministic.
- The card/option locators now support both legacy option buttons and the native radio-label markup from PR #133, so the regression remains valid after #133 becomes the new `pizza` base.
- No production cart behavior changed in response to CI #1682.

A new CI run is required for the updated HEAD. No local tests are claimed.
