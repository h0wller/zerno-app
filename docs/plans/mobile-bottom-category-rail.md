# Mobile bottom category rail — implementation brief

**Status:** implementation contract; tests are being introduced before UI changes.
**Base:** PR #264 HEAD `4c390468d8d677dc3891d7201851a815041b6478`.
**Current audit HEAD:** `f4c82a5532f4029997a8c93e17846c7398221598`.
**Stacked on:** `handoff/253-on-pizza-20261115`.

## Goal

Move the active mobile category rail to the bottom of the viewport as a deliberate part of the app composition. This is not a simple `position: fixed; bottom: 0` relocation.

The first design constraint is the cart. The rail must never hide, displace, or make the cart launcher hard to use.

## Audit baseline

The current mobile rail is a 56px horizontal row (48px in short landscape), in normal flow below `.menu-head`; on portrait <=820px the existing `ui/scrolltop.js` later pins it to the viewport TOP using `.rail-is-pinned` and a `.rail-pin-spacer`. Desktop uses a separate sidebar anchor and must not change.

The current cart FAB is owned by `cart.js`, rendered as `#cartFab.cartFab`, and has a 48–64px visual height, centered, with its current bottom offset including safe-area. It currently sits in the same bottom viewport lane that the new rail needs. The cart sheet is a separate fixed overlay with its own scroll body and footer; Telegram can replace the inner checkout CTA with its native MainButton.

The current critical CSS applies a floating-cart bottom reserve to `#deliveryGrid`, but the first-frame contract is not symmetric for coffee `#grid`. The new reserve must be common across both catalogs.

## Cart-first behavior matrix

Validate at least these states before accepting the layout:

1. **Empty cart:** `#cartFab` remains hidden; the rail is visible and no cart-only lane is reserved.
2. **One item:** FAB is fully visible, count and total are readable, and the full hit target is tappable.
3. **Multiple items / long total:** FAB retains its horizontal layout and readable total without touching the rail.
4. **Cart updates:** add/remove/change quantity and total update the existing FAB without changing rail coordinates or introducing CLS.
5. **Cart open:** `#cartPanel` owns foreground interaction; rail and FAB are non-visible or inert and cannot receive pointer/focus interaction through the sheet.
6. **Checkout:** the last form control, checkout action and footer remain reachable within the sheet's own scroll body and safe area.
7. **Address suggestions / keyboard:** bottom navigation does not cover suggestions, focused controls or active input. Test keyboard viewport shrink where native keyboard cannot be hosted by Playwright.
8. **Telegram Mini App:** check `tg-cart-open`, `tg-native-main` and native MainButton; do not create a competing checkout action.

## Bottom composition contract

### Rail layer

- Keep the existing active brand rail and its content/selected state in their existing brand view. `views.js` remains responsible for active-view DOM placement; do not move the state or content owner.
- On supported mobile/compact viewports, the active rail is fixed to the viewport bottom; it does not depend on scroll threshold.
- Portrait content height is 56px; short-landscape content height is 48px. Every category target remains at least 44px tall.
- The rail surface includes one safe-area extension using `env(safe-area-inset-bottom)`; the background extends behind the system gesture region while interactive controls stop above it.
- Remove the mobile top-pinning/placeholder behavior in `ui/scrolltop.js`; retain desktop anchor/alignment behavior unchanged.

### Cart FAB layer

- The FAB keeps `cart.js` as sole owner of state, render, amount, count, visibility and click behavior.
- Layout reads the actual rendered/visible state of `#cartFab`; it must not duplicate cart quantity or total calculations in `views.js`, `menu.js`, `delivery.js` or `scrolltop.js`.
- When visible, FAB occupies a dedicated lane immediately above the rail, with a measurable non-overlapping gap and preserved full hit target.
- When hidden, the FAB lane collapses. Empty cart must not leave a phantom blank slot.
- Long totals must not increase the FAB beyond its existing maximum 64px visual height or cause vertical wrapping.

### Catalog reserve

Let **B** be the measured fixed bottom surface (rail height + one safe-area extension + top breathing gap). Let **F** be the measured FAB visual height plus its separating gap when the actual FAB is visible.

- Both `#grid` and `#deliveryGrid` reserve at least B.
- They reserve B + F only while the existing FAB is actually visible.
- The last visible product card, all options/quantity controls and its CTA must scroll fully above the top edge of the occupied fixed bottom composition, with an additional measured clearance.
- Delivery subfilters stay in their existing normal-flow region and retain horizontal scrolling; they must not be duplicated inside the rail.
- The initial critical CSS and hydrated CSS must agree on the rail base geometry so no first-frame or hydration jump occurs.

### Overlay, keyboard and auxiliary controls

- While `#cartPanel.open` or `body.cart-open` is active, bottom navigation and the cart FAB are hidden/inert; sheet controls and its footer own interaction.
- Sheet header, `#cartScrollBody`, address suggestions, focused field, summary and footer remain reachable. The footer retains its existing safe-area handling.
- Telegram's native MainButton remains the only checkout CTA in `tg-native-main`.
- Support remains in its current toolbar placement. Toast remains top positioned. Bonus badge continues to use its existing near-footer lifecycle; it must not overlay the FAB or bottom rail. Scroll-to-top and staff-only scan FAB must not intersect the bottom composition.
- No bottom layer may use arbitrary offsets that duplicate the safe-area inset.
- Short landscape must preserve usable catalog height and all primary tap targets.

### Navigation / category change

- Selecting a category must not scroll the viewport to the bottom rail.
- `scrollMenuContentToStart` must align the new catalog/subfilter region with the top content viewport; it must not use the bottom rail's bounding box as a top offset.
- The active rail remains in one fixed bottom coordinate across scrolling, category switches, brand switches and cart updates.
- On brand switch, the old rail is hidden/restored cleanly and only the active brand rail can receive interaction.

### Desktop

- Do not change desktop sidebar rail placement, width, captured anchor, or alignment to the first catalog row.
- Desktop and non-target layouts must not gain bottom fixed navigation or additional bottom reserve.

## Ownership constraints

- `core/views.js`: DOM placement/reflow and active brand view for `#rail` / `#deliveryRail`.
- `menu.js`: coffee rail content and selected state.
- `delivery.js`: delivery rail content and selected state.
- `cart.js`: sole owner of cart state, rendering, `#cartFab` and cart interactions.
- `ui/scrolltop.js`: rail positioning, desktop anchor and category scroll alignment.
- `ui/theme/150-rail.css`: rail geometry and selected indicator.
- `ui/theme/160-01-rail-fab-mobile.css`: mobile FAB/bonus/floating controls styling.
- `ui/theme/60-cart.css`: cart sheet and footer geometry.
- `core/overlay-core.js`: sheet/overlay and Telegram native checkout state.
- `index.html`: minimal Layer 4 first-frame geometry reservation only.
- If DOM ownership/parent placement changes, update `docs/module-map.md` in the same PR.

## Test-first implementation sequence

1. Keep the current baseline artifacts and their exact conditions. Do not update screenshot baselines.
2. Add Playwright regressions first, asserting real bounding boxes, hit testing and interaction outcomes.
3. Run the focused tests and confirm they fail against the current top-rail implementation for the intended reasons.
4. Implement the smallest DOM/CSS/scroll changes without moving cart business logic.
5. Run focused tests, then the required CI groups and full audits.
6. Capture equivalent after screenshots; open and inspect every required frame before declaring visual acceptance. Keep this PR draft until acceptance is recorded.

## Required coverage

- Brands: `coffee` and `delivery`.
- Portrait widths: 320, 360, 390 and 430 CSS px; include the project 390×844 baseline.
- Short landscape: 844×390, plus 1024×390 compact viewport.
- Guest and relevant staff modes where catalog is visible.
- Empty cart, one item, several items / long total, live quantity/price update, cart sheet open, checkout, address suggestions / keyboard.
- Browser PWA and iOS standalone where existing test environment supports it.
- Telegram Mini App where existing mock environment supports it.
- First paint and hydrated state, category changes, brand switches and cart mutations.

## Acceptance criteria

- No overlap among rail, cart FAB, product-card CTA, last card, support/bonus controls and checkout actions.
- With non-empty cart, FAB count/total are legible and its entire hit target resolves to the FAB.
- With empty cart, no cart-only vertical lane is reserved.
- Last card and CTA can be scrolled completely above the occupied bottom composition.
- Safe-area, keyboard viewport shrink, address suggestions and Telegram native checkout remain correct.
- No new CLS or scroll jump during first paint, hydration, category selection or cart mutation.
- Existing desktop sidebar assertions and non-target layouts stay unchanged.
- No screenshots baselines updated; visual acceptance follows `PROJECT_RULES.md §10` with same-condition before/after shots actually opened and inspected.

## Explicit non-goals

- Do not redesign cart contents or checkout business logic.
- Do not move cart state/ownership into `views.js`, `menu.js` or `delivery.js`.
- Do not change desktop rail placement.
- Do not update screenshot baselines to hide unexpected diffs.
- Do not weaken or remove existing assertions.
