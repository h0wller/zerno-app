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
- No local tests are claimed.
- CI must pass on the final PR HEAD before merge.
