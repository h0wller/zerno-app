# UI inventory and baseline capture — 2026-11

> Status: CI screenshot matrix captured for both brands and all four target viewports. This is an isolated Playwright test-server baseline, not a production screenshot set. A separate read-only production spot check is recorded below.

## Capture provenance

### CI / pull request artifact

- PR: [#203](https://github.com/h0wller/zerno-app/pull/203)
- Workflow run: [CI Quality Gates #42823289479](https://github.com/h0wller/zerno-app/actions/runs/42823289479)
- Source branch: `docs/brand-system-baseline-2026-11`
- Source head SHA: `9b042d12737f8648969c8ce6bc436d19439185c5`
- Visual capture job: **E2E / Visual UX capture** — success.
- UI baseline job: **E2E / UI baseline** — success.
- Artifact: `visual-ux-baseline-test-42823289479`
- Artifact ID: `13768141683`
- Artifact size: 4,231,528 bytes; 28 PNG screenshots and 9 JSON metadata files.
- Artifact retention shown by GitHub: until 2026-12-10.
- Screenshot source: `isolated-playwright-test-server`, base URL `http://localhost:3000`; this was not a production URL.
- Test code source: `tests/visual-audit.spec.js`.

The test runs in an isolated browser context, blocks service workers, clears local/session storage before each route, sets the selected brand, waits for the menu grid/cards and skeleton removal, waits for fonts and visible images, and records cold, hydrated viewport, and hydrated full-page states. It asserts that the user is not in a staff role and that document `scrollWidth` does not exceed the viewport.

### Captured screenshot matrix

| Brand | 320 × 740 | 390 × 844 | 768 × 1024 | 1440 × 900 |
|---|---|---|---|---|
| Coffee | Captured | Captured | Captured | Captured |
| Delivery / Пятница | Captured | Captured | Captured | Captured |

For each of the eight brand/viewport combinations the artifact contains three states: initial guest state, hydrated menu viewport, and hydrated full-page menu. It also contains four additional coffee profile/loyalty/promo screenshots at 390 × 844.

Main artifact filenames:

- `COFFEE-GUEST-HYDRATED-MENU-VIEWPORT-{XS,M,T,D}.png`
- `COFFEE-GUEST-HYDRATED-MENU-{XS,M,T,D}.png`
- `COFFEE-GUEST-INITIAL-GUEST-STATE-{XS,M,T,D}.png`
- `DELIVERY-GUEST-HYDRATED-MENU-VIEWPORT-{XS,M,T,D}.png`
- `DELIVERY-GUEST-HYDRATED-MENU-{XS,M,T,D}.png`
- `DELIVERY-GUEST-INITIAL-GUEST-STATE-{XS,M,T,D}.png`
- `COFFEE-PROFILE-LOYALTY-390{,-EXPANDED}.png`
- `COFFEE-PROFILE-PROMO-390{,-EXPANDED}.png`

The JSON files use `role: guest-cold-context`, `staffRole: null`, `deviceScaleFactor: 1`, and document dimensions equal to the viewport widths in all eight guest captures. The full-page document heights vary by brand and viewport; the metadata reports no horizontal overflow in these runs.

## Visual review notes from the captured PNGs

### Coffee

- At 320 px the shell remains legible and the category rail is vertical beside the product card column.
- The search placeholder is clipped by the available input width at this narrow size; this appears to be text truncation inside the field, not page-level horizontal overflow.
- At 390 px the cards remain a single-column sequence beside the category rail.
- At tablet width the menu changes to a two-column card grid.
- At desktop width the menu uses a multi-column grid with the guest profile panel to the right.

### Delivery / Пятница

- The kraft-paper background, chocolate borders and terracotta actions are visibly distinct from the coffee visual language.
- At 320 px the horizontal filter chips continue beyond the visible width while remaining inside the horizontal rail; the vertical category rail and product card remain visible.
- At 390 px and tablet the card list expands while retaining the delivery-specific border/shadow treatment.
- At desktop width the menu uses a three-column card grid and a separate guest profile panel.

### Profile / loyalty

The four additional profile screenshots use a deterministic guest fixture set by the test itself (name `Тестовый гость`, 6/10 stamps, one free coffee reward). They are test-fixture evidence, not live customer information or production account data.

## Separate production spot check

A read-only browser session on 2026-11-10 opened `https://friday.andcoffee.online/?brand=coffee` at 1065 × 991. The page hydrated, showed coffee branding, menu/search/category rail, cart and chat FABs, and guest profile login prompt. No authenticated state or staff role was used. The HTML exposed no deployment commit/version marker.

This spot check does not replace the CI screenshot matrix: it covered coffee only at one viewport, and the browser automation returned structured notes rather than a PNG artifact. The CI PNGs above are explicitly from the isolated test server.

## Static source inventory

### Brand token layer

Source: `public/app/ui/brand-tokens.css`.

- Coffee uses navy `#123A6B`, blue `#3E8FD0`, light surfaces and restrained shadows.
- Delivery uses terracotta `#C03B2A`, chocolate `#3A2A1C`, kraft/tan `#C99E6E`, rice `#EFE6D8`, paper `#F6EEE1`, outlined controls and hard offset shadows.
- Token families cover cards, CTA, panels/tabs, modal/auth, avatar, chat, header/ticker, venue switch, profile, cart, nutrition, composition and loyalty.
- Coffee modal title token is `inherit`; delivery modal title token is `"Unbounded", "Golos Text", sans-serif`.

### Font layer

Source: `public/app/ui/fonts.css`.

Local font-face declarations include Golos Text, Prata and Unbounded. The declarations do not alone establish which family/weight is actually rendered by every UI role. Computed styles are not included in the visual-audit artifact and remain to be captured separately.

### CSS / DOM ownership

Canonical references:

- `docs/css-architecture.md` — CSS layer constraints.
- `docs/module-map.md` — DOM/module ownership.
- `public/app/ui/brand-tokens.css` — brand values.
- `public/app/ui/fonts.css` — font declarations.
- `public/app/core/views.js` — shell and responsive composition.
- `public/app/menu.js` — coffee menu, category and search UI.
- `public/app/delivery.js` — delivery catalogue.
- `public/app/cart.js` and `public/app/checkout-validation.js` — cart and checkout.
- `public/app/profile.js`, `profile-orders.js`, `profile-brand.js` — profile.

### Compact controls and hit-area inventory

Static CSS inspection shows mixed sizing: profile composition includes compact icon controls and 44 px minimum-height full-width actions; other shell and cart controls also use 44 px dimensions. The screenshot artifact is not a complete DOM bounding-box or hit-test inventory. A complete inventory still requires runtime measurements for each control, including pseudo-element hit areas and overlap checks. Do not globally replace 44 px values.

## Additional CI artifacts

The same PR run also uploaded supplementary reports:

- `playwright-Responsive UI-42823289479` — artifact ID `13768240359`.
- `playwright-Mobile Chrome-42823289479` — artifact ID `13767359412`.
- `playwright-Profile-42823289479` — artifact ID `13767264577`.
- `playwright-Visual stability-42823289479` — artifact ID `13768405240`.
- `playwright-UI baseline-42823289479` — artifact ID `13767003911`.

Open the workflow run's **Artifacts** section to download these files. GitHub artifact links expire according to the retention dates shown there.

## Open PR collision register

Last checked on 2026-11-10:

- #179 — open; cart/checkout recipient summary and checkout styling. Avoid editing overlapping cart/checkout files while it remains open.
- #199 — open draft; profile composition and brand tokens. Coordinate profile/token changes with it.
- #185 — merged into `pizza`; its compact controls and shell work are part of the current baseline.
- #182 — closed without merge.

Refresh this register before creating implementation branches.

## Remaining evidence and acceptance

- [x] Both brands captured at 320 × 740, 390 × 844, 768 × 1024 and 1440 × 900 in CI.
- [x] Cold guest, hydrated viewport and hydrated full-page screenshots stored as workflow artifacts; refreshed in successful run #42828826629.
- [x] Staff role absent in guest matrix; CI test asserts viewport width is not exceeded by document scroll width.
- [x] One live production spot check completed for coffee at 1065 × 991.
- [ ] Production screenshot matrix with PNG artifacts and version/deployment identity.
- [ ] Computed typography and token values recorded for both brands.
- [ ] 32 px visible controls and 44 px hit areas inventoried separately.
- [ ] Hit-test overlap, clipped focus rings and safe-area placement checked across roles.
- [ ] Findings mapped to exact selectors and DOM owners.

The baseline is sufficient to compare the current CI-rendered UI across the requested guest viewport matrix. It is not yet a production baseline and does not approve any UI change for merge.

## Staff mobile control hit-test regression

Source: `tests/staff-topbar-layout.spec.js`.

The mobile staff header now has a dedicated regression test for the existing compact role switcher and edit control:

- Brands: coffee and delivery.
- Viewports: 320 × 740 and 390 × 844.
- Controls: four `#modeSeg > button` items plus `#editToggle`.
- Visible geometry: each control is checked for a 32 px visual height and non-zero width.
- Hit-test geometry: `document.elementFromPoint()` is sampled at the midpoint of the top, right, bottom and left edges, inset 2 px from the DOMRect boundary. Each sample must resolve to the control or one of its descendants.
- Overlap: the five visual control rectangles are checked pairwise; any positive-area intersection fails the test.
- Playwright actionability: each role button and edit button receives a center-point `click({ trial: true })` check. Trial mode verifies actionability without dispatching a click, so the test does not change staff mode or activate menu editing.

This is a **hit-test regression guard for the current 32 px visible controls**. It does not implement or assert an expanded 44 × 44 px hit area. That separate tap-target implementation remains unstarted until its geometry can be designed without overlap or clipping at the mobile header edges.

### Successful verification run

- Workflow: [CI Quality Gates #42828826629](https://github.com/h0wller/zerno-app/actions/runs/42828826629)
- Commit: `a6ab37f5da44bc28c54c998e383b27a5b18a6968`
- Result: all 13 jobs passed.
- Relevant job: **E2E / Responsive UI** — passed.
- Playwright report for Responsive UI: 102 passed, 4 skipped, 0 failed, 0 flaky.
- New test: `mobile staff controls receive taps across the usable visual button edges` — passed on first attempt, retry 0, 2.394 s.
- Diagnostic artifact: `playwright-Responsive UI-42828826629`, artifact ID `13770104827`.
- The screenshots below are test-server captures from this successful CI run, not production captures.

Staff header screenshots attached to the responsive diagnostics artifact and extracted for review:

- `coffee-staff-two-row-320px.png`
- `coffee-staff-two-row-390px.png`
- `delivery-staff-two-row-320px.png`
- `delivery-staff-two-row-390px.png`

The four images show the existing two-row staff menu header in both brand themes and both mobile sizes. No CSS was changed in this PR; the work here is a regression guard and an evidence update.
