# UI inventory and production capture log — 2026-11

> Status: partial. Static source inventory is recorded below. Production browser evidence currently covers one guest coffee-brand desktop session only. Do not treat this file as a complete responsive baseline or a visual approval.

## Capture provenance

- Date: 2026-11-10.
- Environment: production, read-only browser session.
- URL: `https://friday.andcoffee.online/?brand=coffee`.
- Brand route: `?brand=coffee`.
- Browser viewport reported by the capture: 1065 × 991.
- Guest state: confirmed; no authenticated user and no staff role.
- Hydration: completed; no pending scripts reported.
- No cart, checkout, order placement or account write action was performed.
- Deployment commit/version marker: not exposed in the inspected HTML.
- Screenshot binary / downloadable PNG was not returned by the browser run. The result is structured browser evidence, not an archived screenshot artifact.

The capture agent reported no visible product-image loading or layout-clipping issue in this one viewport. This is a narrow observation, not proof of mobile or cross-brand correctness.

## Capture gaps

The originally requested baseline matrix is not complete:

| Brand | 320 × 740 | 390 × 844 | 768 × 1024 | 1440 × 900 |
|---|---|---|---|---|
| Coffee | Pending | Pending | Pending | Pending |
| Friday / delivery | Pending | Pending | Pending | Pending |

The only captured session used 1065 × 991, not one of the target viewports. The delivery route was not navigated to. No computed-style or element bounding-box measurements were returned. Do not fill these gaps with estimates.

## Production observations — coffee

Observed at `/?brand=coffee`:

- Document title: `Пятница «…и кофе» — доставка и кофейня`.
- HTML class included `brand-coffee splash-skipped no-splash`.
- Brand route and `brand-coffee` class agreed.
- No `data-brand` attribute was reported on html/body by the capture.
- No data-version / data-commit marker was exposed in the HTML.
- Venue switch control and brand mark were present.
- Search input was visible with coffee-menu copy.
- Ticker was present and scrollable.
- Category rail was visible with coffee categories.
- Product grid and product cards were visible.
- Cart FAB and chat FAB were present.
- Guest profile entry showed phone-number login prompt.
- Product images were reported as 300 × 300 px source/display dimensions.
- No purchase or checkout action was used.

### Important verification item: brand token selector contract

The checked-in `public/app/ui/brand-tokens.css` scopes token blocks to:

- `html[data-brand="coffee"]` and `body[data-brand="coffee"]`
- `html[data-brand="delivery"]` and `body[data-brand="delivery"]`

The production capture reported `brand-coffee` as an HTML class and no `data-brand` attribute on html/body. This is a **contract mismatch to verify**, not yet a confirmed styling defect: the capture did not return computed custom-property values, and another runtime mechanism may set or mirror the tokens. Before editing token selectors, inspect production computed values for `--btn-fire-bg`, `--modal-bg`, `--modal-title-font`, `--profile-btn-bg` and inspect the relevant brand initialization code. Do not add broad compatibility selectors without tracing the runtime owner.

## Static source inventory

### Brand token layer

Source: `public/app/ui/brand-tokens.css`.

- Coffee uses navy `#123A6B`, blue `#3E8FD0`, white/light surfaces, soft borders and restrained shadows.
- Delivery uses terracotta `#C03B2A`, chocolate `#3A2A1C`, kraft/tan `#C99E6E`, rice `#EFE6D8`, paper `#F6EEE1`, outlined controls and hard offset shadows.
- Token families include cards, CTA, panels/tabs, modal/auth, avatar, chat, header/ticker, venue switch, profile, cart, nutrition, composition and loyalty.
- Coffee modal title token is `inherit`; delivery modal title token is `"Unbounded", "Golos Text", sans-serif`.

### Font layer

Source: `public/app/ui/fonts.css`.

Local font-face declarations include Golos Text, Prata and Unbounded. The declaration file alone does not establish which face/weight is actually rendered for each UI role. Computed font-family, font-weight, font-size and line-height must be collected from production at each target viewport.

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

### Compact control / hit-area inventory

Static CSS inspection shows that the profile composition includes 36 × 36 px visible icon controls and 44 px minimum-height full-width actions. Earlier shell/profile rules also contain 44 px controls. This confirms that the codebase has mixed compact and touch-sized controls.

This is **not** a complete 32 × 32 / 44 × 44 selector inventory. A complete list requires a repository-wide search over all loaded stylesheets and dynamically injected styles, plus runtime measurements of rendered boxes and hit testing. Do not globally replace 44 px values.

## Open PR collision register

Last checked on 2026-11-10:

- #179 — open; cart/checkout recipient summary and checkout styling. Avoid editing overlapping cart/checkout files while it remains open.
- #199 — open draft; profile composition and brand tokens. Coordinate profile/token changes with it.
- #185 — merged into `pizza`; its compact controls and shell work are part of the current baseline.
- #182 — closed without merge.

Refresh this register before creating implementation branches.

## Next evidence to collect

1. Repeat production capture for coffee and delivery at 320 × 740, 390 × 844, 768 × 1024 and 1440 × 900.
2. Store actual PNG screenshots and JSON metadata as a GitHub Actions artifact.
3. Record computed styles and bounding boxes for header, ticker, category rail, search, product cards, profile trigger, cart FAB and chat FAB.
4. Record `scrollWidth` versus viewport width and test hit-target overlap.
5. Verify the brand-token selector contract described above.
6. Only then mark the baseline complete and start the first implementation PR.

## Acceptance checklist

- [ ] Both brands captured.
- [ ] All eight target viewport/brand combinations captured.
- [ ] Production commit/version identified or explicitly recorded as unavailable.
- [ ] Screenshots stored as artifacts with metadata.
- [ ] Computed typography and token values recorded.
- [ ] 32 px visible controls and 44 px hit areas inventoried separately.
- [ ] Overlap, clipping, horizontal overflow and focus visibility checked.
- [ ] Findings mapped to CSS layer and DOM owner.
