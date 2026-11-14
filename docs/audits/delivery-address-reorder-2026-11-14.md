# Delivery, address and reorder audit — 2026-11-14

Status: investigation opened; findings must be reproduced on current `pizza` before being called confirmed.

## Current delivery tariffs supplied by the owner

Source: owner-provided screenshot dated 2026-11-14.

- 200 RUB: Янтарный, Покровское, Синявино.
- 500 RUB: Кленовое, Охотное, Русское, Поваровка, Морозовка, Янтаровка, Красноторовка, Ягодное.
- 1100 RUB: Донское, Прислово.

Pickup discount shown in the same source: 10%. Treat pickup eligibility/calculation as a separate rule; do not change it without tracing existing implementation and tests.

These values are the target business reference for this audit. Verify the authoritative server calculation, client display/fallbacks, address normalization and persisted order total before changing implementation.

## Investigation worklist

### P0 — Delivery tariffs and address data
- Compare all screenshot settlements and exact expected tariffs with server routes/domain/seeds and client address/delivery modules.
- Trace the complete path from place selection to checkout display to server-created order total.
- Check aliases, capitalization/spacing/ё normalization, unknown places, manual input and street validation.
- Verify which module owns `window.AddressModule` and remove competing writers only after confirming all consumers.
- Add tests for each settlement and for server-authoritative order totals.

### P0 — Reorder integrity
- Reproduce Telegram/deep-link reorder with variants and multiple paid modifiers/add-ons.
- Compare reconstructed cart payload with the tracked original order and normal cart-add behavior.
- Add regression tests asserting modifier identity, quantity and price are preserved.

### P1 — Cart ownership and mutation
- Trace overlapping handlers/renderers in `cart.js` and `delivery.js`.
- Keep one owner for cart state, DOM mutations and persistence as documented in `docs/module-map.md`.
- Test decrement/removal of earlier rows, modifier-index remapping, localStorage persistence and totals after rerender.

### P2 — Related audit leads
- Check duplicate `#supportChooseOverlay` ownership.
- Check legacy Telegram staff-chat deep-link compatibility.
- Compare menu/chat fallback prices with the current catalog.
- Compare service-worker precache entries with actual font assets.
- Evaluate async CSS/FOUC/CLS using `docs/testing/slow-network-layout.md`; do not change CSS loading based on static suspicion alone.

## Project constraints

- Follow `AGENTS.md`, `PROJECT_RULES.md`, `docs/module-map.md`, `docs/css-architecture.md`, `docs/frontend-todo.md`, `docs/api.md`, `docs/openapi.yaml` and relevant testing guides.
- Do not introduce a second DOM/state owner.
- Keep fixes narrow; do not bundle unrelated refactors.
- Do not weaken assertions or regenerate snapshots to hide unexpected changes.
- Update `docs/module-map.md` if ownership/contracts change.
- UX changes require relevant before/after screenshots; business logic requires regression tests.
- Merge/deploy only after targeted tests and full CI are green and the owner has reviewed the result.

## Acceptance

- Every settlement above resolves to exactly the stated delivery tariff.
- Checkout display and server-persisted order total agree.
- Reorder preserves all variants and modifiers without loss or duplication.
- Cart has one mutation/render owner with regression coverage.
- Relevant Playwright tests and full CI pass.
- PR records tested SHA, CI run and any remaining production-only verification.

