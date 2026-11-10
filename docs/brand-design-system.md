# Brand design systems

> Status: working inventory, based on source inspection of `pizza` and one read-only production capture on 2026-11-10. This is not yet a complete visual sign-off. See [UI inventory and capture log](./ui-inventory-2026-11.md).

## Scope and ownership

The storefront has two distinct visual brands sharing one application shell:

- **…и кофе** (`coffee`) — navy/blue, light surfaces, restrained borders and shadows.
- **Пятница** (`delivery`) — terracotta, chocolate and kraft-paper surfaces, hard borders and offset shadows.

Brand values belong in `public/app/ui/brand-tokens.css`. That file is the Layer 2 token source and must contain custom properties scoped to brand selectors only. It must not become a place for layout rules or unscoped selectors.

CSS layer rules and DOM ownership are governed by:

- `docs/css-architecture.md`
- `docs/module-map.md`
- `AGENTS.md` and its "Где смотреть" section

Before changing a component, locate its DOM owner in `docs/module-map.md`, then change the owning module or its designated stylesheet. Do not patch a neighbouring module with broad global selectors.

## Brand principles

### …и кофе

- Primary brand accent: `#123A6B`; secondary blue: `#3E8FD0`.
- Primary CTA: blue fill, white text, no border, no hard offset shadow.
- Cards: white surface, subtle blue border/shadow, 18px radius.
- Modal: white surface, 18px radius, no decorative background image or border.
- Modal title font token currently resolves to `inherit`.
- Profile primary action uses a navy surface and soft navy shadow; secondary action uses a pale blue surface.

### Пятница

- Core palette: terracotta `#C03B2A`, chocolate `#3A2A1C`, kraft/tan `#C99E6E`, rice `#EFE6D8`, paper `#F6EEE1`.
- Primary CTA: terracotta fill, chocolate border, hard offset chocolate shadow.
- Cards: kraft-paper surface, 2px chocolate border, hard offset shadow, 18px radius.
- Modal: rice surface with a subtle radial dot texture, 3px chocolate border and hard offset shadow.
- Modal title token currently resolves to Unbounded with Golos Text fallback.
- Profile primary action uses terracotta with chocolate border and hard offset shadow.

## Shared design constraints

1. Brand differences must be expressed through semantic tokens, not duplicated brand-specific component markup.
2. Keep brand identity visible in controls: coffee uses restrained blue surfaces; Friday uses its chocolate outline and hard-shadow language.
3. Do not normalize the two brands into one neutral visual language.
4. Focus indicators must remain visible and brand-appropriate.
5. Hover and active states must preserve each brand's shadow/transform language without moving layout.
6. Typography roles must be documented separately from the physical font files. Do not apply display fonts to long-form/body text by broad selectors.
7. Tap-target sizing is a separate concern from visible control sizing. A compact visual control may use a larger hit area, but the hit area must not overlap adjacent actions or be clipped by ancestors.

## Token inventory (source of truth)

The following token families are present in `public/app/ui/brand-tokens.css`:

- Menu cards and badges: `--card-bg`, `--card-border`, `--card-shadow`, `--card-radius`, hover tokens, tag and price colors.
- Primary actions: `--btn-fire-*`, `--cta-*`.
- Panels and tabs: `--panel-*`, `--tab-on-*`.
- Modal/authentication: `--modal-*`, `--mclose-*`, `--alogo-*`, `--ava-*`.
- Chat: `--chat-head-*`, `--chat-msg-*`, `--chat-send-*`, `--chat-fab-*`.
- Header/ticker: `--topbar-*`, `--ticker-*`, `--venue-toggle-*`.
- Profile: `--profile-btn-*`, `--profile-section-*`, `--profile-canvas-*`, `--profile-modal-*`.
- Cart: `--cart-panel-*`, `--cart-qty-*`, `--cart-item-border`, `--cashier-bg`.
- Nutrition/composition/loyalty: `--nutrition-*`, `--composition-chip-*`, `--loyalty-*`.

## Typography

Font declarations are owned by `public/app/ui/fonts.css`. The inspected source declares local font faces for Golos Text, Prata and Unbounded. The brand token `--modal-title-font` selects the modal title family per brand; the coffee value is `inherit`, while Friday uses Unbounded with a Golos Text fallback.

A full role map (display, section heading, body, caption, price, control) is still pending computed-style capture across both brands and target viewports. Do not infer rendered font weights from font-face declarations alone.

## Component ownership

Use `docs/module-map.md` as the canonical map. Current ownership relevant to this audit:

- Global shell/header and responsive composition: `public/app/core/views.js`.
- Brand values: `public/app/ui/brand-tokens.css`.
- Font faces: `public/app/ui/fonts.css`.
- Menu and category interactions: `public/app/menu.js`.
- Delivery catalogue: `public/app/delivery.js`.
- Cart: `public/app/cart.js`.
- Checkout validation: `public/app/checkout-validation.js`.
- Profile composition and behavior: `public/app/profile.js`, `profile-orders.js`, `profile-brand.js`.

These paths are ownership pointers, not permission to bypass the layer rules. Verify the current module map before every implementation PR.

## Known open work / collision boundaries

At the time of the audit:

- PR #179 is open and changes cart/checkout presentation and recipient summary. Do not edit its cart/checkout files in parallel.
- PR #199 is open as a draft and changes profile composition and brand tokens. Profile and token work must be coordinated with that PR.
- PR #185 is already merged into `pizza`; it contains earlier compact-control and shell work. Treat its CSS as current baseline, not as an open branch.
- PR #182 is closed without merge.

Recheck GitHub before each new PR because this list is time-sensitive.

## Change acceptance

Every visual change must include:

- Correct DOM owner and CSS layer identified.
- Both brands checked at mobile and desktop sizes.
- Normal, hover, focus-visible, active, disabled and loading states checked where applicable.
- No horizontal page overflow or clipped focus ring.
- No overlap between neighbouring hit targets, chat/cart floating actions or sticky shell elements.
- Focused Playwright coverage and full required CI checks.
- Before/after screenshots from the same viewport and state.

A green CI run alone is not visual acceptance.
