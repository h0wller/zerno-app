# Mobile bottom category rail — implementation brief

**Status:** draft specification; no UI behavior changed yet.
**Base:** PR #264 HEAD `4c390468d8d677dc3891d7201851a815041b6478`.
**Stacked on:** `handoff/253-on-pizza-20261115`.

## Goal

Move the mobile category rail to the bottom of the viewport and make it a deliberate part of the mobile app composition. This is not a simple `position: fixed; bottom: 0` relocation.

The first design constraint is the cart. The rail must never hide, displace, or make the cart launcher hard to use.

## Cart-first behavior matrix

Validate at least these states before accepting the layout:

1. **Empty cart:** the cart FAB is hidden; the rail remains visually balanced and does not reserve a phantom cart lane.
2. **Cart has items:** the FAB remains fully visible, including count and total; rail and FAB have distinct hit areas and do not overlap.
3. **Cart updates:** adding/removing items and changing quantities updates the FAB without moving the rail or causing layout jumps.
4. **Cart open:** `#cartPanel` owns the foreground interaction; the rail/FAB do not remain clickable through the sheet.
5. **Checkout:** the last form control, checkout action and footer remain reachable above the keyboard and safe area.
6. **Address suggestions / keyboard:** the bottom navigation does not cover suggestions, focused fields or the active input.
7. **Telegram Mini App:** check `tg-cart-open`, `tg-native-main` and Telegram's native MainButton; do not create a second competing checkout action.

## Layout contract to design

- The rail is anchored to the viewport bottom and respects `env(safe-area-inset-bottom)`.
- Content has a matching bottom scroll reserve so the final product card, its quantity/add CTA, and delivery subfilters can scroll fully above the rail.
- The cart FAB has a deliberate lane/priority relative to the rail. Its visible state must be designed for both brands and variable cart totals, not handled by arbitrary offsets.
- The empty-cart state must collapse any cart-only reserve cleanly.
- Fixed UI must not cover toast messages, support launcher, bonus affordance, focus rings or browser/OS gesture areas.
- Short landscape viewports must remain usable; avoid consuming a disproportionate share of the available height.
- Category selection and scroll-to-category behavior must remain stable; no scroll jumps or CLS during first paint, hydration, category changes or cart updates.
- Desktop vertical sidebar behavior remains unchanged.

## Ownership constraints from the current source

- `core/views.js`: DOM placement/reflow of `#rail` and `#deliveryRail`.
- `menu.js`: coffee category rail content and selected state.
- `delivery.js`: delivery category rail content and selected state.
- `cart.js`: sole owner of cart state, rendering and `#cartFab`; the rail must not duplicate cart state or update the FAB itself.
- `ui/theme/150-rail.css`: current rail geometry and active indicator.
- `ui/theme/60-cart.css` plus the cart-specific mobile styles: cart sheet and footer geometry.
- `index.html`: Layer 4 first-frame reservation only; do not turn it into a second full component stylesheet.
- If DOM ownership changes, update `docs/module-map.md` in the same PR.

## Test-first implementation sequence

1. Capture current screenshots for both brands and all relevant cart states at the same viewports used for acceptance.
2. Add Playwright regressions first. They must assert actual visible rectangles and interaction outcomes, not only CSS declarations.
3. Specify the rail/FAB stacking, bottom insets and scroll reserve from the measured geometry.
4. Implement the smallest DOM/CSS change. Preserve cart state and desktop sidebar behavior.
5. Run focused tests, then the repository's required CI groups.
6. Open and inspect every required screenshot. Keep this PR draft until visual acceptance is recorded.

## Required coverage

- Brands: `coffee` and `delivery`.
- Widths: 320, 360, 390 and 430 CSS px; include the current project baseline viewport.
- Portrait and short landscape.
- Guest and relevant staff modes.
- Empty cart, one item, multiple items / long total, cart sheet open, checkout with keyboard, address suggestions.
- Browser PWA / iOS standalone and Telegram Mini App where the existing test environment supports them.
- First paint and hydrated state, plus category changes and live cart updates.

## Acceptance criteria

- No overlap among rail, cart FAB, product-card CTA, last card, support/bonus controls and checkout actions.
- With a non-empty cart, FAB count/total are legible and the entire FAB is tappable.
- The last catalog card and its CTA can be scrolled completely above the rail.
- Safe-area, keyboard, address suggestions and Telegram native checkout behavior remain correct.
- No new CLS or scroll jump during first paint, hydration, category selection or cart mutation.
- Existing assertions remain intact; new behavior is covered by regressions.
- Desktop sidebar and non-target layouts do not regress.
- Visual review follows `PROJECT_RULES.md §10`: same baseline conditions, both brands, portrait/landscape, all relevant states, and screenshots actually opened and inspected.

## Explicit non-goals

- Do not redesign cart contents or checkout business logic.
- Do not move cart state/ownership into `views.js`, `menu.js` or `delivery.js`.
- Do not change desktop rail placement.
- Do not update screenshot baselines to hide unexpected diffs.
- Do not weaken or remove existing assertions.
