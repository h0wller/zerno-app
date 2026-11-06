# Frontend roadmap & UX audit — Zerno

**Base branch:** `pizza`
**Last documentation reconciliation:** 2026-11-06

## Current source-of-truth and status

Historical milestone logs below remain historical. Do not use their old test counts as today's baseline. Current commands and their behavior are defined in root `package.json` and `.github/workflows/ci.yml`.

- Frontend: Vanilla JS ESM, bundled by esbuild from `public/app/main.js`.
- UI ownership: `docs/module-map.md`.
- CSS model: four logical layers with brand sublayers 2a/2b; see `docs/css-architecture.md`.
- UI acceptance: `docs/ui-checklist.md`.
- Slow-network layout: `docs/testing/slow-network-layout.md`.
- API contract: `docs/openapi.yaml`; `docs/api.md` is a historical endpoint index until fully reconciled against route handlers and schemas.
- New product work: spec → review → implementation → tests.

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
- [ ] Ticker below header, no extra gap/shadow; confirm intended movement on reduced-motion clients.
- [ ] Search and category rail alignment; rail below header/search.
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


### G. Feedback from iOS PWA visual review (390×844 pt)
- [ ] **Profile hint removal** — remove the explanatory swipe chip entirely; preserve the native swipe-to-close gesture and verify clean first-open/return behavior.
- [ ] **Profile dismissal backdrop** — after closing the profile drawer, verify that the underlying page returns to the intended blurred/unblurred state with no stale overlay, pointer interception or scroll lock. Do not add a global blur without identifying the backdrop owner.
- [ ] **Promo action** — keep the “OK” action on one line at 320/375/390 px; retain keyboard activation and promo validation.
- [ ] **Coffee profile social links** — distribute the three icon links evenly across the full usable width of their actual card, including safe horizontal insets; retain 42 px touch targets and accessible names.
- [ ] **Checkout recipient block** — replace the current dynamically injected “Получатель” strip with a clear “Получатель заказа” section. Show account name and phone only once, preserve auto-fill, define what is editable, and verify the exact payload submitted to /api/orders before changing fields or server contracts.
- [ ] **Support FAB stacking and icon** — put support launcher below cart/modal layers, preserve visibility on the menu and prevent overlap with product add controls; use an explicit recognizable support icon and retain aria-label.
- [ ] **Admin controls ownership** — keep the edit action inside the staff admin actions rail; avoid duplicating the existing #editToggle. Verify keyboard reachability and role-based visibility.
- [ ] **Role switch placement** — move #modeSeg into the menu header/action block beside the staff/admin actions, not into a second row of the global topbar. Preserve #brandSeg brand choice, role permissions, renderModes() and hydration reservation behavior.
- [ ] **iOS safe-area top strip** — inspect actual iOS PWA visual capture and computed env(safe-area-inset-top), header padding/height, body background and viewport insets. Remove the visible strip without double-applying the safe-area offset or regressing notch devices.
- [ ] Re-capture iOS PWA screenshots for 320/375/390 px and desktop staff states after each bounded PR; record exact commit/viewport/state and inspect image artifacts, not lint alone.

### Proposed bounded PR sequence
1. Profile polish (#177): hint, promo one-line, social distribution, close/backdrop lifecycle.
2. Checkout recipient redesign: markup/state/payload contract separately from visual-only profile work.
3. Staff menu header: role switch + admin rail placement, one edit action, reduced topbar height.
4. Support launcher: lower z-index, clear icon, collision tests with product Add action.
5. Safe-area strip: diagnosis and minimal CSS/viewport fix with iOS-specific evidence.
