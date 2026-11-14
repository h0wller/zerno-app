# Delivery, address and reorder audit — 2026-11-14

Status: implementation and automated verification complete on the audit branch. PR remains draft pending owner review of the attached visual evidence and production-only checks.

## Business reference

Source: owner-provided screenshot dated 2026-11-14.

- 200 RUB: Янтарный, Покровское, Синявино.
- 500 RUB: Кленовое, Охотное, Русское, Поваровка, Морозовка, Янтаровка, Красноторовка, Ягодное.
- 1100 RUB: Донское, Прислово.
- Pickup discount: 10%; eligibility and calculation were left unchanged.

## Findings and disposition

### P0 — Delivery tariffs and address data — CLOSED

- Compared all 13 settlements against the server delivery zones and the owner-provided tariff reference.
- Removed client-side fee overrides/fallbacks that could disagree with the server. Checkout now consumes the published server delivery information.
- Added an integration test that checks every settlement's zone fee and creates an order to assert the persisted total equals product subtotal plus the server tariff.
- Removed the competing `address-dict.js` writer of `window.AddressModule`. The generated `address.js` module is now the sole owner.
- Compared the 13 settlement street lists in the client and `server/domain/address.js`; the data sets match.
- Tightened street validation to require an exact normalized match; the synthetic `(без улицы)` placeholder is no longer accepted as a real street.
- Updated stale address fixtures and added a regression assertion for valid/invalid streets.

### P0 — Reorder integrity — CLOSED

- Extracted the deterministic order-to-cart reconstruction into `public/app/core/order-reorder.js`.
- Repeated orders restore the persisted option index (`oi`), with a compatibility fallback for older orders using option label/size/price.
- Paid modifiers, quantity and price are preserved; item keys include the selected option index to avoid collisions between variants.
- The server validates and persists the selected option index and its resolved option label/size.
- Unit and Playwright regression tests cover a non-default option, paid modifiers and repeated-order cart reconstruction.

### P1 — Cart ownership and mutation — CLOSED

- Removed the legacy cart renderer and duplicate quantity/persistence handlers from `delivery.js`.
- `cart.js` is the only owner of cart initialization, state mutation, persistence, rendering and opening.
- Delivery-card add/stepper actions delegate to the cart owner. Order tracking and deep links use the explicit `replaceCartItems` contract rather than mutating the shared array directly.
- Updated `docs/module-map.md` with the ownership boundary.
- Regression coverage checks card geometry, compact in-cart state, 44px CTA hit target, no row overflow, stepper persistence, expanded-modifier row identity and order repeat behavior.
- Visual inspection of the first 228px screenshot exposed a 28px-wide in-cart CTA. The first CSS attempt lost to a later, more-specific mobile rule in `160-12-admin-bar-tail.css` (CI measured 28px). The winning override is now corrected at that cascade owner: at widths up to 260px the row gap is removed and the CTA reserves 44px while both step controls remain 44px. The test asserts hit-target width and no row overflow.

### P2 — Related leads — CLOSED / NO DEFECT

- `#supportChooseOverlay`: removed the duplicate creator from `deeplink.js`; `chat-core.js` remains the owner.
- Legacy `?tab=staff_chat&key=`: delegates to the exported `openStaffChatThread(key)`; Playwright coverage verifies that the requested thread is opened.
- Menu/chat fallback prices: compared with `server/db/seed.js`; values match and remain fallback-only.
- Service worker: added the missing local `golos-text-400.woff2` font to `STATIC_ASSETS` and added a unit guard that compares locally declared WOFF2 fonts with precache entries.
- Async CSS: 34 stylesheet links use the async pattern and have matching `noscript` fallbacks. No CSS-loading change was made. The CI visual-stability and responsive suites passed; the slow-network contract remains the source for future changes.

## Verification evidence

- Latest full CI before the final screenshot-only test refinement: run `43635302132`, commit `22b462602e69401fd5f99202e36570c59491435e`; all 13 jobs passed, including Code Quality & Guardrails, Cart and checkout, Auth, PWA, Responsive UI, Mobile Chrome responsive and Visual stability.
- CI Playwright artifacts were downloaded and inspected for Mobile Chrome responsive and Cart and checkout. The mobile artifact covers both brands and narrow/mobile/tablet viewports; the cart artifact covers 320/390/1280px and checkout/address/recommendation states.
- The delivery-card CTA test waits for the transient toast to leave and attaches a separate screenshot of the CTA itself, so the evidence is not obscured by a notification. The cascade-owner correction and regression assertions are awaiting the latest CI run.
- No screenshot baseline was regenerated.

## Remaining acceptance — not a code defect

- Owner review of the latest unobscured delivery-card CTA screenshot and the CI visual artifacts.
- Production smoke after merge/deploy: verify the same 13 delivery tariffs and one repeat-order flow against the deployed build.
- This PR must remain draft until the owner accepts the visual evidence. Do not merge based only on static checks or a green CI run.

## Project constraints observed

- No pickup-discount eligibility change.
- No changes to server-authoritative order totals beyond persisting/validating the selected option index.
- No parallel DOM/state owners introduced.
- `docs/module-map.md` updated with the cart ownership contract.
