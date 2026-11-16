# UI motion system — proposal and implementation plan

**Status:** Draft; inventory started, no animation behavior changed.
**Base:** `pizza`.
**Scope:** motion and transitions across the storefront PWA. This PR is intentionally separate from the coffee category rail layout fix.

## Goal

Make interface motion coherent, purposeful and fast without making the app feel slower. Motion should clarify state changes and hierarchy, not decorate every element.

## Repository-grounded starting inventory

Initial source search on 2026-11-16 found existing motion in several ownership areas:

- `ui/theme/20-cards.css`: product-card entrance animation and image transitions.
- `ui/theme/70-ticker.css` + `admin-extra.js`: marquee motion, with a reduced-motion manual-scroll fallback.
- `ui/theme/80-splash.css` + critical CSS in `index.html`: splash entrance/float effects and reduced-motion handling.
- `ui/theme/90-modals.css`, `100-chat.css`, `130-service.css`, `140-topbar.css`: modal, chat, service and topbar transitions.
- `core/swipe.js`: panel nudge and hint fade keyframes.
- `core/views.js`: delivery option shake and role/control pulse rules.
- `ui/styles.js`: chat hint pulse effects.
- `ui/theme/160-01-rail-fab-mobile.css`: cart FAB and badge transitions.
- `core/fx.js`: canvas confetti.
- `core/deeplink.js`: order-card flash.

This is an initial search inventory, not a complete audited list. Before implementation, inspect each owner and existing tests; do not move component motion into a global stylesheet just to centralize it.

## Motion principles

1. **Purpose first:** use motion only to communicate entrance, exit, selection, feedback, hierarchy or progress.
2. **Short and restrained:** prefer opacity and transform; avoid animating layout-affecting properties unless there is a demonstrated need.
3. **Consistent timing:** establish a small duration/easing scale after auditing current transitions and interaction latency.
4. **Reduced motion:** honor `prefers-reduced-motion: reduce` for every nonessential animation and transition. Essential state changes remain perceivable without motion.
5. **No hidden delays:** animations must not delay click/tap response, navigation, checkout or API work.
6. **Stable layout:** no CLS, scroll jumps, hit-target movement or accidental overlay interception.
7. **Brand-aware, not duplicated:** use existing semantic tokens; keep behavior in its current component owner.
8. **Performance:** avoid continuous expensive paint effects; pause nonessential loops when hidden/offscreen where appropriate.

## Proposed work sequence

1. **Audit / baseline:** enumerate animations and transitions by owner; classify purpose, trigger, duration/easing, reduced-motion behavior, performance risk and test coverage. Capture guest coffee/delivery baseline plus key overlays.
2. **Motion tokens:** propose a minimal shared timing/easing vocabulary only after the inventory. Do not introduce a new abstraction if existing tokens/ownership suffice.
3. **Core interaction pass:** prioritize category selection, card interaction/entrance, cart FAB/cart sheet, modal/drawer open-close and brand/mode changes.
4. **Feedback pass:** review validation shake, success feedback, chat hints, order flash and confetti; remove redundant or persistent attention-grabbing loops.
5. **Accessibility and performance:** test reduced motion, keyboard/focus, touch, hidden tabs, low-end mobile behavior and no layout shift.
6. **Visual acceptance:** inspect before/after screenshots and short recordings for both brands, portrait/landscape and relevant overlay states.

## Non-goals

- No category, product, pricing, cart or checkout business-logic changes.
- No redesign of layout or component placement.
- No global animation override that disables all motion indiscriminately.
- No new animation library or runtime dependency without a measured need.
- No baseline updates to hide unexpected visual changes.

## Acceptance gate

- Every changed animation has an explicit purpose and owner.
- Reduced-motion behavior is tested for every changed motion path.
- No interaction is delayed by animation completion.
- No CLS, scroll jump, horizontal overflow or focus/hit-target regression.
- Coffee and delivery are both checked.
- Portrait and landscape, including short landscape, are checked for affected components.
- Before/after screenshots or recordings are opened and reviewed; record commit SHA, viewport, brand, role and state.
- CI and targeted Playwright pass. Keep this PR Draft until visual acceptance is complete.
