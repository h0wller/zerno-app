# Staff role controls and tap targets

## Placement contract

- In guest/admin menu states, the `.menu-controls-row` spans the menu header: the left group contains `h1` and `.upd` (menu update timestamp); the right group contains role switcher (`#modeSeg`) and permitted edit control (`#editToggle`).
- The role row is above the search row; search/support remain full-width underneath.
- Mobile edit action shows its icon face; desktop shows the labeled «Редактировать» action.
- In cashier/orders (work modes), the menu view is hidden, so `#modeSeg` returns to `header.topbar` and `#editToggle` returns to `#adminBar`.
- Placement is owned by `core/views.js`; it is based on whether the menu view is visible, not on a viewport breakpoint.

## Target register

| Selector / count | Visible face | Hit area | DOM / behavior owner | Geometry / brand owner | Scope |
| --- | --- | --- | --- | --- | --- |
| `#modeSeg > button` (4 role buttons) | Desktop: one 176 × 36 px segmented track with four contiguous 44 px role cells. Mobile: 32 × 32 px face with 6 px inset. | Desktop: native compact target. Mobile: 44 × 44 CSS px. | `core/catalog.js` renders modes; `core/views.js` owns gating and placement. | Layer 1: `160-12-admin-bar-tail.css`; Layer 2a: `brand-tokens.css`; Layer 2b: `core/views.js`; Layer 4: critical CSS in `index.html`. | In menu header while menu is visible; topbar only in work modes. |
| `#editToggle` (1 edit action) | Desktop: compact labeled action. Mobile: 32 px icon face. | Desktop: native compact target. Mobile: 44 × 44 CSS px. | `menu-editor.js` owns edit behavior; `core/views.js` owns placement. | Same layers as above. | Next to role switcher in menu header when allowed; `#adminBar` in work modes. |
| `header.topbar #profileTopBtn` | Mobile: 32 × 32 px circular avatar face. | Mobile: 44 × 44 CSS px. | `profile.js` writes the initial only; the existing button node remains owned by the static app shell. | Layer 1: `170-profile-button.css` plus mobile geometry in `160-12-admin-bar-tail.css`; neutral dimensions use `--tap-*`. Brand face uses `--ava-*` from Layer 2a. | Guest and authenticated sessions in both brands; desktop sizing unchanged. |
| `#deliverySubFilter .subchip` | Mobile: 40 px visible pill, natural width (minimum 58 px). | Mobile: 44 px high, natural width; event box remains inside the existing scroll rail. | `delivery.js` creates/renders the chips and owns delegated filter/tab actions. | Layer 1 component owner: `160-09-preorder-subfilters.css`; Layer 4 in `index.html` reserves only first-paint geometry/face. Brand appearance uses Layer 2a tokens. | Delivery ingredient filters at 320/390 px; desktop sizing/scrollbar unchanged. |
| `.ac-add-btn` (recommendation add actions) | 44 × 44 px button with 10 px corner radius; plus/count remains inside the button. | 44 × 44 CSS px. Four side-midpoint hit checks pass before and after adding at 320/390 px. | `cart.js` renders the recommendation DOM and owns add-to-cart state/action. | Layer 1 component rules in `160-08-cart-addons.css`; no brand-specific geometry override. | Recommendation cards inside the open cart; primary cart CTA and business behavior unchanged. |

## Mobile geometry contract

- Each mobile staff control occupies a **44 × 44 CSS px** hit cell.
- The visible role/edit face remains **32 × 32 px**, centered with a 6 px inset on all sides.
- Four role cells form a 176 × 44 px row; the edit cell is 44 × 44 px.
- Role track remains 32 px high.
- An 8 px row gap separates the role/edit hit cells from the search row.
- Hit cells do not overlap; corners and edge-midpoints resolve to the intended control using `elementFromPoint()`.
- Keyboard focus is drawn around the 32 px visible face.
- Mobile staff header reserves 108 px total: 44 px control row, 8 px gap, 44 px search/support row, plus header padding.
- Guest header remains at its existing 100 px geometry. Expanded geometry is scoped to `html[data-staff-role]`.

## Desktop geometry contract

- Desktop uses a three-column row: flexible title/timestamp, fixed 176 × 36 px role switcher (four contiguous 44 px cells), fixed 150 × 36 px labeled edit action. The role and edit controls never shrink or overlap the title group.
- At 821 px and wider the timestamp sits below the title in the left column. The title group may truncate, but it never pushes the role or edit columns.
- The mobile 44 px hit-cell expansion is not applied to desktop.
- Search/support remain in a full-width second row.
- The role switcher must not return to the topbar while the menu remains visible, even above 820 px.
- Desktop first-paint critical CSS reserves the menu role row before authentication hydration. In menu mode, the role/edit actions stay in that row; the separate admin bar may remain visible for other admin actions but has zero layout footprint. In work modes, the role switcher/edit return to the topbar/admin bar.

## Brand treatment

Layout is shared; brand-specific appearance uses tokens from `public/app/ui/brand-tokens.css`:

- Coffee: navy track, pale-blue active role face, blue focus ring, soft shadow and white edit face on mobile.
- Delivery: chocolate track, tomato-red active role face, chocolate focus ring, rice-paper edit face and hard chocolate edit shadow on mobile.
- Desktop retains the delivery chocolate/terracotta and coffee navy/pale-blue switcher treatment.

The mobile hit cell itself remains transparent. The visible background, border and shadow are drawn on an inset pseudo-element.

## Ownership and cascade

- **DOM movement / role gating:** `public/app/core/views.js`.
- **Shared geometry (Layer 1):** `public/app/ui/theme/160-12-admin-bar-tail.css`.
- **Brand tokens (Layer 2a):** `public/app/ui/brand-tokens.css`.
- **Brand-state selectors and responsive layout (Layer 2b):** `public/app/core/views.js`.
- **First paint (Layer 4):** critical CSS in `public/index.html`, mirroring desktop and mobile staff menu placement before hydration.
- No API, business rule, server behavior or `public/app/main.js` changes.

The mobile profile avatar uses a 44 × 44 px button box with a 32 × 32 px inset brand face. Its keyboard focus ring uses the active brand's `--flame` token.

Delivery filter `.subchip` controls keep their 40 px visible pill and current variable width (minimum 58 px). On mobile, the button box is 44 px high and the visible `::before` face is inset 2 px vertically; it is not expanded outside the scrollport. Negative vertical margins keep the flex contribution and rail height unchanged. The component CSS owner is `160-09-preorder-subfilters.css`; `index.html` carries only the minimal first-paint mirror. `tests/tap-targets.spec.js` checks the full button box, unchanged visible width and four edge points with `elementFromPoint()`.

The support launcher, chat close/send, cart modifier controls and recommendation tabs have local 44 px implementations or existing focused tests. They keep their component-owned pseudo-elements and should not receive a second generic pseudo-element.

Changes to tap-target geometry must update this register and the matching Playwright assertions in the same PR.

## Verification

`tests/tap-targets.spec.js` covers the profile avatar across both brands, guest/cashier/dispatch/admin sessions and 320/375/390 px viewports. It verifies a 44 × 44 px event box, 32 × 32 px visible face, eight points on the circular target perimeter with `elementFromPoint()`, center actionability and horizontal overflow. It also covers delivery ingredient chips at 320/390 px: the 40 px visible pill remains unchanged in both height and width inside a 44 px button box; `elementFromPoint()` verifies hits at top/bottom and left/right edges, without clipping or horizontal overflow.

`tests/cart-checkout-clarity.spec.js` now covers `.ac-add-btn` at 320×740 and 390×844, before and after the in-cart state change. It asserts a 44 × 44 px button/action box and uses the four side midpoints with `elementFromPoint()`; corner points are deliberately excluded because the 10 px rounded corners are not part of the rectangular edge-hit contract. Existing component-owned checks remain in place for recommendation tabs and modifier controls.

`tests/staff-topbar-layout.spec.js` covers:
- coffee and delivery at 320 × 740 and 390 × 844;
- 44 × 44 mobile hit cells and 32 × 32 visible faces;
- all four corners and four edge-midpoints with `elementFromPoint()`;
- brand-specific role/edit faces, no overlaps, search clearance and keyboard focus;
- desktop 821/1024/1440 px menu row alignment and placement for both brands;
- desktop delivery role-switcher colors;
- work modes returning the switcher to topbar only when menu is hidden.

`tests/slow-network-layout.spec.js` covers guest/mobile and cached staff/desktop first-paint geometry before and after auth hydration.


## Latest CI verification — 2026-11-13

- Code/test head for this tap-target verification: `d6a4688af26c60a691a2c41de52a5ddcce5784b1`; subsequent commits through `e989e515f70be246bc88b8636d7a8a3e068e588d` update documentation only. CI #3072 is validating that latest documentation head.
- [CI Quality Gates #3064](https://github.com/h0wller/zerno-app/actions/runs/43427135621): all **15/15 jobs passed**.
- Cart and checkout: **25 passed**; Responsive UI: **139 passed, 4 skipped**; Mobile Chrome: **102 passed, 4 skipped**.
- `.ac-add-btn` checks are included in `tests/cart-checkout-clarity.spec.js`: four side-midpoint points at 320×740 and 390×844, before and after the in-cart state change.
- Production guest menu capture was archived separately in artifact [#14037897354](https://github.com/h0wller/zerno-app/actions/runs/43427135621/artifacts/14037897354); it is visual baseline evidence, not a tap-target test on production controls.
