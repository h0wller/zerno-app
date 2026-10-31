# Slow-network layout regression

This document records the layout contract for the delivery storefront and the regression checks that protect it. The goal is to catch first-paint shifts before they reach production, not to preserve arbitrary pixel values.

## What caused the regression

The first viewport was rendered before deferred theme CSS and web fonts had finished loading. The critical styles in `public/index.html` did not reserve the same geometry as the final theme:

- the delivery header changed its internal grid/flex sizing as deferred CSS arrived;
- the delivery wordmark could move when the coffee-brand text was hidden or when `Golos Text` / `Prata` swapped in;
- staff-only controls appeared after authentication hydration and could increase the header height;
- the number of eager product images did not follow the actual first row after viewport changes or menu re-renders.

The fix reserves first-paint geometry and caches only the staff role hint needed to reserve the staff header row. The server response remains authoritative; the cached role is only a layout hint.

## Layout contract

The menu grid breakpoints are intentional and must not be changed by this regression work:

| Viewport width | Menu columns |
| --- | ---: |
| 320–519 px | 1 |
| 520–1180 px | 2 |
| 1181–1599 px | 3 |
| 1600 px and wider | 4 |

Other invariants:

- At widths up to 1023 px, the delivery header shows the delivery mark without the coffee wordmark.
- From 1024 px, the desktop wordmark and subtitle are visible.
- Every image-bearing card in the actual first grid row loads eagerly; only the first such image receives `fetchpriority="high"`.
- Image loading priorities are recalculated after menu renders, deferred fonts, and viewport resizing without changing the canonical grid breakpoints.
- The page must not have horizontal overflow.
- Header, brand mark, search, product-card media, and key controls must retain their measured geometry when deferred theme CSS and fonts finish loading.
- Cumulative layout shift in the slow-network scenario must remain below `0.01`.
- Staff mode controls must be reserved before `/api/me` resolves when a cached role hint exists. Failure to write that hint to storage must not invalidate authentication.

## Automated coverage

Run the focused checks locally:

```sh
npx playwright test tests/slow-network-layout.spec.js --project=chromium
npx playwright test tests/registration.spec.js --project=chromium
```

The slow-network suite covers:

1. First-paint versus post-CSS geometry at a throttled theme-CSS load.
2. Responsive header and menu geometry at 320, 480, 519, 520, 690, 691, 820, 821, 1023, 1024, 1180, 1181, 1599, and 1600 px.
3. Cached staff-role hydration, including the delayed `/api/me` response and the bundle-failure watchdog.
4. Cross-tab login restarts server-side auth hydration before applying a staff hint; logout clears the old tab immediately.
5. CLS, horizontal overflow, image loading priority before and after CSS, viewport resizing, initial-card preservation, and desktop/mobile wordmark visibility.

The registration suite verifies that local-storage quota errors do not break staff login, session updates, or cross-tab logout cleanup.

## Visual review artifacts

The responsive test attaches full-page Chromium screenshots at 320, 390, 520, 690, 820, 821, 1024, 1181, and 1600 px after deferred CSS and fonts have loaded.

Every CI run uploads the HTML report and test results as the `playwright-diagnostics` artifact, including successful runs. For PR #92, a successful E2E job also commits the exact generated bundle, service worker, and matching `index.html` used by the tests as tracked production assets. Open the report and inspect the attached screenshots when changing:

- critical CSS in `public/index.html`;
- `160-03-topbar-search-panel.css`, `160-04-wrap-cls-sheets.css`, or `160-06-delivery-header.css`;
- delivery card rendering or responsive breakpoints;
- staff-role hydration that affects the header.

Visual checklist:

- delivery logo is centered and not clipped;
- venue switch and profile button have balanced spacing;
- desktop wordmark appears only at the desktop breakpoint;
- menu columns match the table above;
- cards and their media do not stretch or overflow;
- no content is pushed below the first viewport unexpectedly;
- screenshots before/after CSS remain visually equivalent apart from intended font rendering.

Do not relax the geometry or CLS assertions to make a failing test pass. Fix the source of the shift and inspect the new screenshots.
