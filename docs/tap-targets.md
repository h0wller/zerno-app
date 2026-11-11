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
| `#modeSeg > button` (4 role buttons) | Desktop: compact native button face. Mobile: 32 × 32 px face with 6 px inset. | Desktop: native compact target. Mobile: 44 × 44 CSS px. | `core/catalog.js` renders modes; `core/views.js` owns gating and placement. | Layer 1: `160-12-admin-bar-tail.css`; Layer 2a: `brand-tokens.css`; Layer 2b: `core/views.js`; Layer 4: critical CSS in `index.html`. | In menu header while menu is visible; topbar only in work modes. |
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

- The desktop labeled edit action uses a fixed 150 × 36 CSS px box so the first frame and authenticated state share identical geometry. The mobile 44 px hit-cell expansion is not applied to desktop.
- The left group is title + update timestamp, both aligned to the left; the right group is role switcher + edit, aligned to the right.
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
