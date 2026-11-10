# Mobile staff tap targets

## Scope

This change applies only to the compact staff controls moved into the mobile menu header:

- the four-button `#modeSeg` role switcher;
- the `#editToggle` edit control.

It does not change the desktop/work-mode role switcher, profile controls, filter chips, or other compact controls. Those require separate inventory and acceptance.

## Target register

| Selector / count | Visible face | Hit area | DOM / behavior owner | Geometry / brand owner | Scope and exclusions |
| --- | --- | --- | --- | --- | --- |
| `#modeSeg > button` (4 role buttons) | 32 × 32 px face, 6 px inset | 44 × 44 px per button | `core/catalog.js` renders the modes; `core/views.js` owns role gating and DOM placement | Layer 1: `160-12-admin-bar-tail.css`; Layer 2a: `brand-tokens.css`; Layer 2b: `core/views.js`; Layer 4: staff critical CSS in `index.html` | Mobile staff menu header only; desktop/work-mode placement is unchanged |
| `#editToggle` (1 edit action) | 32 × 32 px inset face/icon treatment | 44 × 44 px | `menu-editor.js` owns edit behavior; `core/views.js` owns placement | Same Layer 1 / 2a / 2b / 4 ownership as above | Mobile staff menu header only; editor behavior and ID are unchanged |

The registry is intentionally limited to this PR's first staff-header slice. It does **not** claim migration of profile controls, filter chips, cart controls, general support controls, or all other 32 px surfaces.

## Geometry contract

- Each interactive control occupies a **44 × 44 CSS px** hit cell.
- The visible face remains **32 × 32 CSS px**, centered with a 6 px inset on all sides.
- The four role cells form a 176 × 44 px row; the edit cell is 44 × 44 px.
- The role track remains 32 px high.
- An 8 px grid gap separates the bottom edge of the role/edit hit cells from the search row.
- The five hit cells may touch edge-to-edge, but must not overlap.
- All four edge-midpoints of each hit cell must resolve to the intended control through `elementFromPoint()`.
- Keyboard focus is drawn around the 32 px visible face, not around the full 44 px hit cell.
- The staff header reserves its final geometry before hydration: 108 px menu head, 52 px first-row reservation (44 px controls plus 8 px clearance), 44 px search/support row.
- Guest header geometry remains unchanged at 100 px. The expanded geometry is scoped to `html[data-staff-role]`.

## Brand treatment

The layout is shared. Brand-specific appearance is provided by tokens in `public/app/ui/brand-tokens.css`:

- Coffee: navy track, pale-blue active face, blue focus ring, soft active shadow, white edit face.
- Delivery: chocolate track, tomato-red active face, chocolate focus ring, rice-paper edit face, hard chocolate edit shadow.

The hit cell itself remains transparent. Background, border and shadow are painted on the inset pseudo-element so the visible surface does not grow to 44 px.

## Ownership and cascade

- **DOM ownership / movement:** `public/app/core/views.js`. It remains the owner of moving the role switcher and edit control between the topbar and menu header.
- **Shared mobile component geometry:** `public/app/ui/theme/160-12-admin-bar-tail.css` (Layer 1).
- **Brand values:** `public/app/ui/brand-tokens.css` (Layer 2a).
- **Brand-state selectors:** `public/app/core/views.js` (Layer 2b); these reference tokens and do not duplicate geometry.
- **First-paint reservation:** the staff-scoped critical CSS in `public/index.html` (Layer 4). It mirrors only the dimensions needed to avoid a hydration/layout shift.
- No DOM node ownership, node order, API, business rule, or server behavior changes. `public/app/main.js` is untouched.

## Verification

`tests/staff-topbar-layout.spec.js` covers coffee and delivery at 320 × 740 and 390 × 844:

- exact 44 × 44 hit-cell geometry;
- exact 32 × 32 visible pseudo-element geometry and 6 px insets;
- edge-midpoint hit testing on all four sides of every role button and the edit control;
- brand-specific track/active/edit face colors;
- no positive-area overlap between the five hit cells;
- at least 4 px clearance before search;
- keyboard focus visibility on the 32 px face;
- screenshot attachments for both brands and both viewports.

Related regression coverage:

- `tests/slow-network-layout.spec.js`: guest header stays at 100 px; cached staff geometry is reserved before hydration and does not shift.
- `tests/pour-accessibility.spec.js`: compact staff controls use 44 px hit cells while non-staff controls retain their existing geometry.
- `tests/ui-baseline.spec.js`: active brand face is checked on the pseudo-element rather than the transparent hit cell.
- `tests/mobile-support-entry.spec.js`: existing support-launcher/search separation remains covered.

The 44 px contract is limited to the two staff menu-header controls above. It is not a claim that every 32 px control in the application has been migrated.
