# Frontend roadmap & UX audit — Zerno

**Base branch:** `pizza`
**Last documentation reconciliation:** 2026-11-22

## Current source-of-truth and status

Historical milestone logs below remain historical. Do not use their old test counts as today's baseline. Current commands and their behavior are defined in root `package.json` and `.github/workflows/ci.yml`.

- Frontend: Vanilla JS ESM, bundled by esbuild from `public/app/main.js`.
- UI ownership: `docs/module-map.md`.
- CSS model: four logical layers with brand sublayers 2a/2b; see `docs/css-architecture.md`.
- UI acceptance: `docs/ui-checklist.md`.
- Slow-network layout: `docs/testing/slow-network-layout.md`.
- API reference: `docs/api.md` is the concise route/guard index, checked against the 77 production method/path/guard entries on `pizza`; `docs/openapi.yaml` carries request/response details and still requires schema-level verification.
- New product work: spec → review → implementation → tests.

## Consolidation scope — PR #273

PR #273 consolidates the non-superseded work from PRs #264–267 on current `pizza`:
- continuous ticker cycle, accessible pointer/keyboard pause and reduced-motion behavior;
- compact mobile AdminBar/header, 80px desktop sidebar, wide centered wrapper and three-column catalog cards at tablet widths;
- delivery venue/search/subfilter layout, short category label and stable card content slots;
- compact in-cart CTA label without changing cart business logic;
- shared modal focus trap, push-subscription cleanup, OTP limits/store bounds and regression coverage;
- detached no-horizontal-scroll category capsule, safe-area/catalog reserve and cart-open behavior.

The old sticky/pinned rail implementation is intentionally not restored. PR #269's selected-category scroll-to-top and primary-rail fade remain the current behavior. Rail geometry stays CSS-owned; no DOM reparenting or screenshot-baseline refresh is part of this consolidation.

## Active UX audit — client before staff

This is an audit queue, not a declaration that each item is defective.

### A. Evidence collection and screenshot baseline
- [x] Deterministic isolated guest sessions for coffee and delivery.
- [x] Cold and hydrated first-viewport guest menu screenshots at 320×740, 390×844, 768×1024 and 1440×900; CI run 42185234269 (test server).
- [x] Supplemental full-page hydrated catalog captures; `content-visibility` is temporarily disabled only for these long screenshots and is flagged in JSON metadata. Do not use them for first-viewport scoring.
- [ ] Production guest baseline, and customer cart/checkout/profile states; test-server screenshots are not production acceptance evidence.
- [ ] Staff sessions: cashier, dispatcher, admin after guest baseline.
- [ ] Verify ticker placement, header dimensions, logo rendering, menu/card hierarchy, text wrapping and controls against production screenshots.
- [x] Attach screenshots to findings/PRs; record commit, role, brand and viewport.

### B. Header, ticker, search and rail
- [ ] Header width/height and compactness.
- [ ] Guest brand switches + logo + profile aligned in a single centered row.
- [ ] Ticker below header, no extra gap/shadow; verify continuous duplicated-group movement, invisible click/keyboard pause-play and reduced-motion behavior.
- [ ] Verify floating category capsule on iOS/Android PWA and Telegram: safe-area, scroll reserve with/without cart FAB, open-cart suppression, fade/reduced-motion, and both brands.
- [ ] **Delivery rail scroll accessibility** — keep `aria-current="location"` synchronized with the visible section while preserving `aria-pressed` as the actual filter selection; coffee and delivery manual selection use the same current/selected contract. Implementation and regression coverage are under review in [PR #295](https://github.com/h0wller/zerno-app/pull/295); mark complete only after CI passes. Native iOS/Telegram gesture acceptance remains separate.
- [ ] Swipe-dismiss from profile/modal does not cause header/page jump.

### C. Catalog and product selection
- [ ] Card content hierarchy: image, name, description, composition, variants, price and CTA.
- [ ] Pizza variant radio group: no accidental selection; selected state and missing-selection error are clear.
- [ ] Modifier/add-on controls and price changes.
- [ ] Empty/loading/out-of-stock states and image dimensions.

### D. Cart and checkout
- [ ] Expanded modifiers remain expanded when an earlier row is removed.
- [ ] Remove, decrement, quick-addon removal and index/state re-mapping.
- [ ] Qty, selected variant, addons, totals and discount line items remain consistent.
- [ ] Checkout data, scheduled slot and validation survive expected navigation/re-render.
- [ ] Client submit lock and server retry/idempotency are evaluated separately.

### E. Slow network / runtime
- [ ] First paint vs hydration, delayed fonts/CSS/images and CLS.
- [ ] Staff-only controls do not leak into guest view.
- [ ] brand switch and bfcache restore do not cause stale header geometry or jump.
- [ ] Use the contract in `docs/testing/slow-network-layout.md`; do not loosen assertions to hide shifts.

### E1.1 Authenticated coffee first paint — PR #308

- [x] Add a regression test that holds `/api/me` and proves an actual coffee catalog card can render before the staff response is released; after a verified staff role, confirm the full `/api/menu/all` response replaces the interim public list.
- [ ] Confirm the RED test against the current `pizza` source, then verify GREEN after the boot change and run the complete CI matrix.
- [ ] Compare authenticated coffee LCP against the recorded production capture under matching device/network/cache conditions. The source capture is bundle `v=4177`; current production's later delivery trace is `v=4198`, so do not combine the numbers.
- [ ] Capture and inspect the first catalog frame for coffee and delivery, guest and staff, at mobile portrait/landscape and desktop viewports. Keep PR #308 Draft until the PROJECT_RULES.md §10 review record is complete.

### E1. Mobile initial catalog / LCP — PR #300

**Current state on 2026-11-22:** C8 implementation, cleanup and automated verification are complete on PR branch `perf/mobile-lcp-initial-load` at `8db36bf3bf9d82adf5ae3cb89f0628afda168201`. The PR is still Draft and is not merged into `pizza`.

- [x] Guest-only speculative catalog request while splash is pending, gated by a valid saved `zt_brand`; no prediction for authenticated users or when no valid saved brand exists.
- [x] Reuse a matching prediction after brand selection; ordinary selected-brand fallback on HTTP 503/network abort; block late mismatched preload/hidden delivery-hero activation.
- [x] Explicit-brand document `Link` preload for the first active image in the initial visible category, with local-media and responsive-image guards.
- [x] Deterministic `?lighthouse=1` / `?clean=1` audit brand selection and integration/Playwright regression coverage.
- [x] Remove one-shot/perf experiment scaffolding from the PR tree; retain the CI Lighthouse fixture/summary scripts. The `perf-exp` branch itself was not deleted.
- [x] Full CI [run 45030665869](https://github.com/h0wller/zerno-app/actions/runs/45030665869): 14/14 jobs successful on the final HEAD.
- [ ] Complete same-context before/after visual acceptance on production assets for both brands, splash/first catalog frame, mobile portrait/landscape/short landscape, desktop, relevant staff states, cart/checkout and keyboard/focus/safe-area geometry. Record reviewed frames and disposition per `PROJECT_RULES.md §10`.
- [ ] Treat post-deployment production/field verification as a separate step after the PR is accepted and merged; CI fixtures and lab Lighthouse do not provide field data.

Lighthouse comparison in run 45030665869 used two repeats per baseline/PR × brand. Observed trace LCP moved from 589.5→559 ms for coffee and 490→332.5 ms for delivery, while simulated LCP moved 4745→4639 ms for coffee and 5067→5156 ms for delivery. This is preliminary lab evidence; do not present it as an across-the-board or field improvement. The accepted A/F/C8 click-to-card series measured a preceding candidate, not the final HEAD; no additional benchmark series was started.

Full contract, ownership, evidence, cleanup and residual acceptance gate: [docs/testing/mobile-lcp-initial-load.md](testing/mobile-lcp-initial-load.md).

### F. Staff UX after client audit
- [ ] Cashier lookup/stamp/redeem/scan.
- [ ] Dispatcher queue, status, delay and preorder information.
- [ ] Admin editor, promotion controls, dashboard and settings.
- [ ] Staff header/buttons remain compact and do not stretch parent containers.

## Verified completed work (source-grounded)

- PR #128: menu rail and reduced-motion ticker follow-up (verify current implementation before changing).
- PR #130: cart/menu clarity changes.
- PR #133: native pizza variant radio selection and related regression work.
- PR #148: static CSS audit cleanup, merged 2026-11-05. Not a visual redesign PR.

The list above does not imply that current production screenshots have been visually approved.

## Known separate concerns

- [ ] **Native iOS/Android bridge** — separately scope a native bridge for platform capabilities; keep web/PWA behavior functional without the bridge. No native implementation is part of the current category-rail work.

- Server-side order idempotency must not be conflated with the client submit lock.
- Account deletion/settings UX and push/Telegram routing have separate acceptance requirements.
- Business rules (discount windows, pickup discounts, welcome grants/free delivery) require separate tests and must not be changed during a visual-only PR.
- Do not imply free delivery applies to all customers when it is eligibility-bound.

## PR rules
- Base every UX PR on `pizza`.
- One bounded concern per PR; include source evidence, before/after screenshots and targeted Playwright.
- Run CI quality gates and Playwright. For visual PRs inspect actual screenshots; green lint alone is not visual approval.
- Merge only when CI is green and relevant browser states have been reviewed.
- Update `docs/module-map.md` for ownership changes.
- Never regenerate snapshot baselines as a substitute for investigating an unexpected diff.


## G. iOS PWA visual-review feedback (390×844 pt)

Completed on the current `pizza` baseline:
- [x] Profile swipe hint removal, promo action on one line, coffee social-link distribution and clean drawer dismissal — [PR #177](https://github.com/h0wller/zerno-app/pull/177), merged as `401fa8f`.
- [x] Mobile support launcher integrated into the storefront toolbar; preserves chat behavior and avoids floating overlap with product actions — [PR #167](https://github.com/h0wller/zerno-app/pull/167), merged as `52083e2`.
- [ ] Support launcher icon/accessibility label and cart/modal stacking on states where the control remains fixed; verify on iOS PWA and desktop before marking the original FAB request fully closed.

Still active / under review:
- [ ] **Checkout recipient block** — [PR #179](https://github.com/h0wller/zerno-app/pull/179) is draft. Preserve the existing server-derived recipient contract; do not add recipient fields to `POST /api/orders` without a separate API decision.
- [ ] **Staff controls placement** — [PR #182](https://github.com/h0wller/zerno-app/pull/182) is draft. Current proposal: in guest menu mode, keep `#modeSeg` in the menu-title row and place the single existing `#editToggle` there when permitted; in cashier/dispatch/admin work modes, restore `#modeSeg` to the topbar and `#editToggle` to `#adminBar`. Preserve role gating, IDs, keyboard reachability and hydration behavior. This supersedes the older #178 wording that required the edit action to remain in the admin rail in every mode.
- [ ] **iOS safe-area top strip** — still open; no implementation PR is recorded. Inspect real iOS PWA screenshots and computed safe-area/header values before changing CSS.
- [ ] Re-capture affected screens at 320/375/390 px and desktop staff states after each PR; inspect actual PNGs and record commit, viewport and role.

The former #178 proposal to schedule #177 and #167 is obsolete because both are merged. Do not score CI capture alone as visual acceptance.
