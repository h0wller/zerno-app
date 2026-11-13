# Frontend roadmap & UX audit — Zerno

**Base branch:** `pizza`
**Last documentation reconciliation:** 2026-11-13

## Current source-of-truth and status

Historical milestone logs below remain historical. Do not use their old test counts as today's baseline. Current commands and their behavior are defined in root `package.json` and `.github/workflows/ci.yml`.

- Frontend: Vanilla JS ESM, bundled by esbuild from `public/app/main.js`.
- UI ownership: `docs/module-map.md`.
- CSS model: four logical layers with brand sublayers 2a/2b; see `docs/css-architecture.md`.
- UI acceptance: `docs/ui-checklist.md`.
- Slow-network layout: `docs/testing/slow-network-layout.md`.
- API reference: `docs/api.md` is the concise route/guard index, checked against the 77 production method/path/guard entries on `pizza`; `docs/openapi.yaml` carries request/response details and still requires schema-level verification.
- New product work: spec → review → implementation → tests.

## Active UX audit — client before staff

This is an audit queue, not a declaration that each item is defective.

### A. Evidence collection and screenshot baseline
- [x] Deterministic isolated guest sessions for coffee and delivery.
- [x] Cold and hydrated first-viewport guest menu screenshots at 320×740, 390×844, 768×1024 and 1440×900; latest CI run [#3033](https://github.com/h0wller/zerno-app/actions/runs/43421869883) (artifact `visual-ux-baseline-test-43421869883`, artifact ID `14034162976`) was visually inspected for both brands. The eight hydrated viewport captures were individually reviewed from the CI artifact. They remain test-server supporting evidence, not production acceptance; the screenshots use fixture catalog data and placeholder media.
- [x] Supplemental full-page hydrated catalog captures; `content-visibility` is temporarily disabled only for these long screenshots and is flagged in JSON metadata. Do not use them for first-viewport scoring.
- [x] Production guest menu runtime inspection for both brands at 320×740, 390×844, 768×1024 and 1440×900: selected brand class/data-brand, visible first card, staff-only visibility and horizontal overflow were measured in isolated guest sessions. Runtime typography and brand tokens are recorded in `docs/audits/visual-ux-scorecard.md`.
- [x] Production deployment identity verified from deploy run [#43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619): `pizza` at `c005b1c6832a5b722c97c43dd7cd525f638c209b`; the server log confirms checkout, build and PM2 reload.
- [x] Archive and individually inspect all eight production guest PNGs: coffee/delivery at 320×740, 390×844, 768×1024 and 1440×900. The dedicated production job in [CI run #3064](https://github.com/h0wller/zerno-app/actions/runs/43427135621) saved eight exact-viewport PNGs plus a manifest in [artifact #14037897354](https://github.com/h0wller/zerno-app/actions/runs/43427135621/artifacts/14037897354); all eight were opened individually and visually reviewed. The screenshots identify production commit `c005b1c6832a5b722c97c43dd7cd525f638c209b`.
- [ ] Customer cart/checkout/profile/bonus states; production guest-menu inspection does not cover these.
- [ ] Staff sessions: cashier, dispatcher, admin after customer-state baseline.
- [x] First-viewport header, ticker, logo, search, category rail and catalog hierarchy reviewed against the archived production screenshot matrix. Non-blocking observations (320px coffee placeholder truncation, desktop coffee empty auxiliary panel and ticker separator glyphs) are recorded in `docs/audits/visual-ux-scorecard.md` for targeted triage.
- [x] Attach screenshots to findings/PRs where persistent artifacts exist; record commit, role, brand and viewport.

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

The historical completed-work list above does not imply that every current production screen is approved; the separate first-viewport guest menu subset is now archived and reviewed in `docs/audits/visual-ux-scorecard.md`.

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
