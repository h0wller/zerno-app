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

Changes to staff-control placement or hit-area dimensions must update this register and the matching Playwright assertions in the same PR.

## Verification

`tests/staff-topbar-layout.spec.js` covers:
- coffee and delivery at 320 × 740 and 390 × 844;
- 44 × 44 mobile hit cells and 32 × 32 visible faces;
- all four corners and four edge-midpoints with `elementFromPoint()`;
- brand-specific role/edit faces, no overlaps, search clearance and keyboard focus;
- desktop 821/1024/1440 px menu row alignment and placement for both brands;
- desktop delivery role-switcher colors;
- work modes returning the switcher to topbar only when menu is hidden.

`tests/slow-network-layout.spec.js` covers guest/mobile and cached staff/desktop first-paint geometry before and after auth hydration.


## Extended control inventory — Stage 1

The original register above covers the mobile staff menu row. This section adds shared header, support and cart controls without changing their DOM owners.

| Selector / control | Visible face | Hit area | DOM / behavior owner | CSS owner | State |
| --- | --- | --- | --- | --- | --- |
| `header.topbar #profileTopBtn` | 32 × 32 px inset circle | 44 × 44 px existing header cell | `profile.js` updates only the initial text; node and click behavior remain unchanged | `170-profile-button.css` base; `160-06-delivery-header.css` reserves hit cell; `160-12-admin-bar-tail.css` paints mobile face | Added shared token usage and 32px pseudo-face; new test covers guest in both brands at 320/375/390px and staff in both brands at 320/390px |
| `.chat-h button` (`#chatClose`, `#chatSend`) | 32 × 32 px inset square | 44 × 44 px | `chat.js` | `100-chat.css` | Existing eight-point boundary checks in `mobile-support-entry.spec.js`; include in consolidated audit |
| `.addon-tab-btn` | 32 px-high inset pill | At least 44 px high and 44 px wide | `cart.js` | `160-08-cart-addons.css` | Existing boundary hit-test in `cart-checkout-clarity.spec.js` |
| `.ci-toggle-mods-btn` | Compact text action | At least 44 px high; width is content-sized | `cart.js` | `160-08-cart-addons.css` | Existing cell-edge hit-test; wide control, do not extend horizontally |
| `.ci-mod-chip` | 32 px-high pill; width depends on label | At least 44 px high and 44 px wide | `cart.js` | `160-08-cart-addons.css` | Existing boundary hit-test; own `::before` paints the pill and focus ring |
| `.ci-mod-del` | 32 × 32 px inset square | 44 × 44 px | `cart.js` | `160-08-cart-addons.css` | Existing boundary hit-test; own `::before` paints the control and focus ring |
| `#deliverySubFilter .subchip` | 40px visible pill | 44px button box; content-sized width | `delivery.js` | `160-09-preorder-subfilters.css` + mobile cascade in `160-12-admin-bar-tail.css` | Button itself owns the 44px target; `::before` paints the 40px face with a 2px vertical inset. Regression checks four cardinal hit points and bottom-edge actionability at 320/375/390px |
| `#chatFab` / `#supportLauncherHost` | Existing branded support icon | 44 × 44 px | `core/views.js` relocates host; `chat.js` owns chat action | `160-15-mobile-support-toolbar.css` | Existing 44px slot, no extra extension; separately verify Telegram swipe interaction |
| `#scrollTopBtn`, `#venueToggle` | Current visual size is already larger than 32px | Existing 44px+ control | `scrolltop.js` / header controls | `160-06-delivery-header.css`, `160-12-admin-bar-tail.css` | Explicit exception: do not shrink these controls as part of this pass |

### Shared tokens and profile implementation

Neutral Layer 1 tokens are defined in `public/app/ui/theme/160-05-base-components.css`:

- `--tap-visual: 32px`
- `--tap-hit: 44px`
- `--tap-extend-x` / `--tap-extend-y: 6px`

The mobile profile button keeps its existing 44px layout cell. Its visible background, border and shadow are rendered on an inset pseudo-element; the button text remains the profile initial. Focus is drawn on the inset face. No DOM or profile-state ownership changed.

### Remaining acceptance work

- [ ] Complete consolidated edge/keyboard evidence for chat and cart controls — tracked in [issue #232](https://github.com/h0wller/zerno-app/issues/232).
- [x] Resolve the delivery subfilter vertical hit-area clipping with a 40px face / 44px hit region contained by rail padding; browser regression added for 320/375/390px.
- [ ] Complete native iOS standalone and Telegram Mini App touch/gesture acceptance — tracked separately in [issue #231](https://github.com/h0wller/zerno-app/issues/231).
- [ ] Inspect the updated 320/375/390px screenshots and staff menu captures after CI. Do not treat Chromium as native WebKit/Telegram evidence.


### Delivery subfilter hit-area implementation

The subfilter button itself is 44px high and owns the hit region. Its `::before` paints the 40px visible pill with a 2px inset on each vertical edge; no synthetic pointer-active pseudo-layer is used. The rail's existing vertical padding contains the button without changing horizontal scroll width. The `delivery.js` DOM and click owner are unchanged. Playwright checks the four cardinal edge points, bottom-edge actionability, rail containment, no vertical scroll expansion and no page-level horizontal overflow at 320/375/390px. The automated test is browser evidence only; native iOS and Telegram behavior remain explicitly open under issue #231.
