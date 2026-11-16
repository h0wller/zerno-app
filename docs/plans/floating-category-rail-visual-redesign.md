# Floating category rail — visual redesign proposal

**Status:** CSS fallback implemented; CI green on `dfcf332ab0f736465bca760e3884d63f9999083f`; guest and staff visual review completed. Staff-state visual review completed. Native adapter is deferred to a separate follow-up.
**Parent:** PR #265, head `ff6be95d72e1bd7d308011aa7f9cc207ba50fcf4`.
**Scope:** mobile/compact-landscape category rail only. No cart, category-data, checkout, or business-logic changes.

## Decision

Use a **detached floating capsule** rather than a full-width bottom bar.

- Keep the rail visually separated from the viewport edge: 12px horizontal inset and 10–12px bottom breathing room, plus the device safe-area inset.
- Use a content-width surface sized to its category controls, capped at `calc(100vw - 24px)`. If all categories do not fit, the rail itself scrolls horizontally; do not shrink hit targets or wrap labels.
- Use a single continuous capsule with a generous radius (24–28px), subtle elevation and no visible outer stroke. The selected category is indicated by a compact filled icon/label treatment; avoid the old full-width underline.
- Keep each interactive target at least 44×44 CSS px. Short landscape may reduce visual padding, not the hit target.
- The component remains fixed to the visual viewport while scrolling, but is no longer flush with or visually attached to the bottom edge. “Detached” does not mean returning it to document flow: that would make navigation disappear during catalog scrolling.

## Surface and transparency

Use a layered material with progressive enhancement:

1. Base fallback: opaque/semi-opaque token-driven surface with sufficient contrast. This is the default when blur is unsupported or reduced transparency is requested.
2. Web enhancement: `backdrop-filter: blur(18–22px) saturate(150–180%)` with a translucent brand-token surface, plus a restrained shadow. Do not rely on blur alone for contrast.
3. Respect `prefers-reduced-transparency: reduce` where supported; otherwise provide a user-agent-safe opaque fallback. Respect light/dark appearance through existing semantic tokens rather than hardcoded brand colors.
4. Keep coffee and delivery visually coherent in geometry while allowing each brand's existing tokens to determine surface and active colors.

The material must remain legible over light, dark, image-heavy and high-contrast catalog content. No transparency value is accepted from CSS inspection alone: validate the rendered result on both brands and real iOS/Android devices.

## Native rendering handoff (option 3)

The web UI remains the source of truth and fallback. Native rendering is an optional adapter, not a second state owner.

- In Capacitor iOS/Android shells, a future native adapter may render the rail surface and controls using platform-native drawing/material APIs.
- The JS rail owners continue to own category data, selected state and navigation. They send a serializable view model (items, selected id, accessibility labels, enabled state) to the adapter; native taps return a category id through a documented event/bridge contract.
- Native output must not duplicate business logic, cart state, category filtering, or analytics ownership.
- If the native plugin is missing, unsupported, fails to initialize, or the app runs in Safari/Chrome PWA/Telegram Mini App, use the CSS implementation without blocking startup.
- Do not attempt to infer “native” from user-agent strings alone. Detect bridge/plugin capability explicitly.
- Native rendering must be opt-in by capability and must pass parity checks for selected state, keyboard/accessibility semantics where applicable, 44px targets, safe-area, brand switching and cart-sheet visibility.
- A native overlay must not be introduced until its z-order, hit-testing, VoiceOver/TalkBack semantics, orientation lifecycle, and event teardown are specified and tested.

**Important limitation:** a web page cannot ask iOS Safari or Android Chrome to arbitrarily redraw a DOM element as a system-native control. CSS system materials are a web-rendered approximation; true native rendering requires a Capacitor plugin and platform code. This PR defines that seam but does not claim that native rendering already exists.

## Ownership and non-goals

Preserve the current ownership documented in `docs/module-map.md`:

- `core/views.js`: active-view DOM placement/reflow.
- `menu.js` and `delivery.js`: rail items and selected category state.
- `ui/theme/150-rail.css`: shared rail geometry and visual treatment.
- `ui/theme/20-cards.css` and the existing critical first-frame reservation: catalog scroll clearance.
- `cart.js`: sole owner of cart state, FAB and cart interactions.

No body-level host or DOM relocation is proposed at this stage. Do not change cart business logic, FAB behavior, category data, desktop sidebar, Telegram MainButton, or checkout.

## Layout and interaction contract

- Preserve the current compact viewport predicate and desktop sidebar behavior.
- The rail must not cover the last product card/CTA, delivery subfilters, toast, support launcher, bonus controls or cart FAB.
- Recalculate catalog bottom scroll reserve from the measured floating rail footprint and actual visible FAB lane. Empty cart must not reserve a phantom FAB lane.
- With the cart sheet open, the rail is hidden/inert as in the current contract.
- Keep category selection and scroll-to-content behavior unchanged.
- Horizontal scrolling must not steal vertical page scrolling; use a deliberate horizontal gesture threshold and retain keyboard navigation.
- The rail must remain within the visual viewport during iOS keyboard presentation and short landscape; if the available height is insufficient, it must not obscure primary content.
- Reduced-motion settings disable nonessential transitions. Focus-visible remains clearly visible.

## Implementation sequence

1. Added Playwright regressions for detached geometry, actual viewport edge gap, safe-area accounting, horizontal overflow, hit targets, catalog clearance, cart FAB visible/hidden, cart sheet, brand switch, keyboard and compact landscape. RED confirmed on the previous edge-docked implementation: 12 viewport/brand cases failed on a 0px bottom gap; 179 unrelated responsive tests passed. Updated existing slow-network and cart geometry assertions to the new detached contract without weakening the checks.
2. Confirm RED on the exact parent head before implementation. Keep existing assertions; do not update screenshot baselines.
3. Implement the CSS fallback and critical first-frame geometry in their existing owners. Keep DOM and state owners unchanged.
4. Capture equivalent before/after screenshots for coffee/delivery, portrait/short landscape, guest/staff where relevant, empty/non-empty cart and cart sheet.
5. Open and inspect every required frame; record commit SHA and visual review per `PROJECT_RULES.md §10`.
6. Only after the CSS version is accepted, implement and validate the optional Capacitor native adapter in a separately scoped follow-up unless the existing native shell already has an established rendering bridge.

## Acceptance matrix

- Viewports: 320×740, 360×800, 390×844, 430×932, 844×390 and 1024×390.
- Brands: coffee and delivery.
- States: guest catalog, staff catalog where rail is visible, empty cart, visible cart FAB, cart sheet open, brand switch, keyboard/focus.
- Platforms: iOS Safari and standalone PWA; Android Chrome and installed PWA; Telegram Mini App fallback; Capacitor iOS and Android only when the bridge is available.
- Assertions: detached bottom gap includes safe-area exactly once; capsule stays inside horizontal viewport; targets ≥44px; no horizontal page overflow; last card and CTA can scroll fully clear; no FAB/rail overlap; no empty-cart reserve; no CLS or scroll jump; cart and TMA behavior unchanged; desktop sidebar unchanged.
- Visual review: same-condition before/after frames, opened and inspected. No baseline updates to conceal differences.

## Explicit non-goals

- No changes to cart state/rendering or checkout.
- No redesign of category names, ordering, filtering or business behavior.
- No desktop navigation redesign.
- No unconditional native dependency and no UA-specific hacks.
- No claim of native system rendering in a browser-only PWA.


## Current implementation and verification record

- CSS fallback is implemented in the existing owner files: `150-rail.css`, `20-cards.css` and the critical first-frame reservation in `index.html`. Category data/state, DOM placement, cart logic and desktop sidebar ownership were not moved.
- CI run [43944948904](https://github.com/h0wller/zerno-app/actions/runs/43944948904) on `dfcf332ab0f736465bca760e3884d63f9999083f`: all 13/13 jobs passed, including Code Quality & Guardrails, Mobile Chrome responsive, Responsive UI, Cart and checkout, and Visual UX capture.
- Opened and visually inspected the current guest captures from artifact `visual-ux-baseline-test-43944948904`: coffee/delivery at 390×844, 320×740 and short landscape 844×390. Detached capsule, active-state treatment, horizontal clipping behavior, safe-area gap and delivery subfilter/card hierarchy were reviewed. No screenshot baseline was updated.
- Opened and visually inspected staff screenshots from artifact `playwright-Responsive UI-43944948904`: coffee/delivery admin rail at 390×844. The capsule remains detached, selected state is visible, and the rail does not interfere with the two-row staff header. The transient admin-mode toast is present in the captured state but does not overlap the rail.
- Guest and staff visual review is complete for the captured states. This is not device-level iOS/Android acceptance; the artifact is Chromium CI evidence.
- Native rendering adapter is not implemented in this PR. Repository inspection found Capacitor shells but no existing category-rail rendering bridge; keep native work as a separately scoped follow-up after CSS acceptance.


Additional visual check: the delivery cart sheet screenshot `delivery-cart-sheet-open-390x844` was opened and inspected; the category rail is not visible over the sheet.
