# Zerno visual UX scorecard

**Status:** baseline protocol; ratings are intentionally pending inspected screenshots.  
**Baseline source:** `pizza` branch.  
**Production reference:** https://friday.andcoffee.online/  
**Audit owner:** storefront first; staff interfaces after the customer baseline stabilizes.

## Purpose

This scorecard measures the quality of the customer experience and visual presentation screen by screen. It is not a product-image audit, an automated test summary, or a source-code review. Images are considered only as one part of the page composition and content hierarchy.

Each screen gets a stable screenshot ID, its own criterion scores out of 10, a weighted total, evidence-backed findings, and a before/after comparison after implementation.

## Baseline capture contract

Every screenshot record must include:

- Screenshot ID and relative file path.
- Capture timestamp and exact commit SHA (or production URL/build where a commit cannot be established).
- Brand: coffee or delivery.
- Role/auth state: cold guest, hydrated guest, authenticated customer; staff roles are a later phase.
- Exact URL and query parameters.
- Viewport width × height and device scale factor.
- State: first paint, hydrated menu, scrolled catalog, product detail/variant, cart, checkout, profile, bonuses, modal/overlay.
- Capture source: dedicated Playwright visual-audit run, Firecrawl browser capture, or historical CI artifact.
- Evidence quality: `baseline` (isolated, repeatable and visually inspected), `supporting` (component/regression test), or `preliminary` (unknown session or unverified visibility).

Never score a preliminary capture as a final baseline. A Firecrawl HTML scrape does not prove a guest-visible state. A test screenshot taken against a seeded test database is not a production screenshot. DOM presence is not visibility. Do not include customer personal data, active order details, tokens, or staff secrets.

## Viewport matrix

| Key | Viewport | Purpose |
|---|---:|---|
| XS | 320 × 740 | Very compact phone |
| M | 390 × 844 | Primary phone |
| T | 768 × 1024 | Tablet |
| D | 1440 × 900 | Desktop |

At minimum, record XS and M for the mobile-first storefront. T and D are required before declaring a page responsive and visually accepted across breakpoints.

## Score dimensions

Each dimension is rated 0–10. Use integer or half-point scores. A high score requires positive visual evidence, not merely the absence of an obvious defect.

| Dimension | Weight | 10 means |
|---|---:|---|
| Visual hierarchy | 20% | The primary purpose, key information and next action are immediately obvious |
| Composition and spacing | 15% | Alignment, balance, rhythm and whitespace feel intentional |
| Typography and readability | 15% | Text hierarchy, line length, size, contrast and wrapping are comfortable |
| Navigation and orientation | 15% | Users know where they are and how to move between relevant sections |
| Action clarity and feedback | 15% | Controls are discoverable; selected, loading, success and error states are understandable |
| Density and content quality | 10% | No distracting clutter or unhelpful empty areas; content is easy to scan |
| Responsive fit and accessibility | 10% | No clipping/overflow; touch, focus, safe area and contrast are usable |

**Weighted screen score** = sum(score × weight). Report to one decimal place. Never average away a critical defect: add a severity flag and state the blocker separately.

### Score interpretation

- 9.0–10.0: polished; only minor refinements.
- 8.0–8.9: strong; a few focused improvements.
- 7.0–7.9: usable but visibly inconsistent or unnecessarily effortful.
- 6.0–6.9: several notable usability or presentation problems.
- 4.0–5.9: substantial friction; redesign of the screen structure may be needed.
- 0.0–3.9: broken, confusing or inaccessible for the tested task.

Do not invent scores when a screenshot has not been inspected. Use `—` (not assessed).

## Screen inventory and stable IDs

For every screen, capture the first viewport and a full-page/scroll capture where the content makes that useful. The following is the initial screen inventory; add states when a real workflow reveals them.

| Screen ID | Brand | Screen/state | XS | M | T | D | Priority |
|---|---|---|---:|---:|---:|---:|---|
| COF-HOME | Coffee | Cold/hydrated first viewport and header | pending | pending | pending | pending | P0 |
| COF-MENU | Coffee | Catalog, search, category navigation and scroll | pending | pending | pending | pending | P0 |
| COF-ITEM | Coffee | Item details, sizes/volumes and add action | pending | pending | pending | pending | P1 |
| COF-PROFILE | Coffee | Customer profile | pending | pending | pending | pending | P1 |
| COF-BONUS | Coffee | Loyalty stamps, progress, gift and QR entry | pending | pending | pending | pending | P1 |
| COF-CART | Coffee | Cart / selected items | pending | pending | pending | pending | P1 |
| COF-CHECKOUT | Coffee | Checkout and validation | pending | pending | pending | pending | P1 |
| DEL-HOME | Delivery | Cold/hydrated first viewport and header/ticker | pending | pending | pending | pending | P0 |
| DEL-MENU | Delivery | Catalog, search, category rail and scroll | pending | pending | pending | pending | P0 |
| DEL-ITEM | Delivery | Pizza/item details and variant selection | pending | pending | pending | pending | P1 |
| DEL-CART | Delivery | Cart, quantities, modifiers and totals | pending | pending | pending | pending | P0 |
| DEL-CHECKOUT | Delivery | Address, delivery/pickup, slot, payment and validation | pending | pending | pending | pending | P0 |
| DEL-PROFILE | Delivery | Customer profile, orders and settings | pending | pending | pending | pending | P2 |
| DEL-ORDER | Delivery | Order confirmation/tracking | pending | pending | pending | pending | P1 |

Staff phase (after guest baseline): CASHIER, DISPATCH, ADMIN. Use the same capture metadata and scoring dimensions, but do not combine these with customer-facing averages.

## Preliminary visual review — CI screenshot set (2026-11-05)

**Evidence class:** supporting, not final production baseline. Screenshots are actual rendered pixels from the Playwright CI test server with fixture/test catalog data. They are suitable for evaluating shell geometry, hierarchy, typography, navigation and visible overlays; they are not suitable for judging real production product photography, catalog completeness, live promotion content or the final production guest state.

**Weighted scores (7 dimensions, out of 10):**

| Screen / viewport | Score | Primary evidence |
|---|---:|---|
| COF-MENU · 320×740 | 7.5 | Ticker is an intentional looping marquee; support/chat launcher crowded the next card in this pre-#167 capture |
| COF-MENU · 390×844 | 7.4 | Ticker clips; support/chat FAB crowds card media |
| COF-MENU · 768×1024 | 8.1 | Better two-column balance; ticker uses the intended continuous marquee |
| COF-MENU · 1440×900 | 7.5 | Menu and bonus sign-up card are visible; lower sidebar area remains quiet, pending production review |
| DEL-MENU · 320×740 | 6.6 | Floating support/chat FAB obscures the Add area; horizontal filter chips are clipped |
| DEL-MENU · 390×844 | 6.6 | Support/chat FAB overlapped Add in the pre-#167 capture; ingredient filters continue horizontally; ticker is an intentional marquee |
| DEL-MENU · 1440×900 | 7.8 | Profile sign-in card is visible; ingredient-filter chips clip at the right edge; category rail and ingredient filters are distinct navigation levels |

These are provisional screen scores for the rendered CI state, not product acceptance scores. Replace/reconfirm them with the production capture before considering the baseline frozen. The seven component scores are recorded in the score register above.

### Screenshot evidence inspected

| Screenshot ID | Viewport | Capture state | Evidence notes |
|---|---:|---|---|
| COF-MENU-XS | 320×740 | Guest first viewport | Header, ticker, rail, search and first card inspected |
| COF-MENU-M | 390×844 | Guest first viewport | Header, ticker, rail, search and card overlay inspected |
| COF-MENU-T | 768×1024 | Guest first viewport | Two-column menu and navigation inspected |
| COF-MENU-D | 1440×900 | Guest first viewport | Three-column catalog and right-side panel inspected |
| DEL-MENU-XS | 320×740 | Guest first viewport | Filter clipping and floating support FAB/Add overlap inspected |
| DEL-MENU-M | 390×844 | Guest first viewport | Floating support/chat button visibly covers part of the Add control |
| DEL-MENU-D | 1440×900 | Guest first viewport | Three-column cards, hydrated guest profile prompt and ingredient-filter clipping inspected |

Artifact: `visual-ux-baseline-test-42089915249.zip` (GitHub Actions run `42089915249`). It contains 16 viewport PNGs and 8 state metadata JSON files. The full-page hydrated catalog PNGs are supplementary; score rows above use first-viewport captures at the same viewport.

**Ticker behavior clarification (2026-11-06, source/test review):** the ticker's clipped viewport is intentional. `admin-extra.js` adds a hidden duplicate announcement group only when the complete text group overflows, then loops the pair with `zt-marquee`. Under `prefers-reduced-motion: reduce`, the animation is disabled and `.tickerViewport` becomes horizontally scrollable. `tests/pour-accessibility.spec.js` verifies the duplicate group, animation, 34px height, zero header gap, reduced-motion mode, and manual scroll. Do not file a ticker defect solely because text extends beyond the viewport in a static screenshot; verify that the marquee runs or that reduced-motion scrolling works.

**Hydration/capture correction (2026-11-06, run `42185234269`, test server):** the earlier “empty right-side delivery profile” observation was invalid. The cold screenshot was captured before the guest profile resolver completed; the stable hydrated desktop capture shows the selected Profile tab and visible phone sign-in prompt. At widths up to 1180px the profile panel is an intentionally closed drawer, so its body is not expected to be visible in the storefront viewport. The horizontal row contains ingredient filters; the left rail contains menu categories and they are not duplicate navigation.

The capture now records three separate states: cold first viewport, hydrated first viewport (normal CSS, `fullPage: false`), and supplementary full-page catalog. The full-page capture temporarily sets `content-visibility: visible` on catalog cards so off-screen content is rendered; metadata records `fullPageContentVisibilityOverride: true`. Do not use that supplemental image as a first-viewport score source. The screenshots remain test-server evidence, not production acceptance evidence.

**First confirmed UX finding from the test screenshots:** the fixed support launcher `#chatFab.chat-fab` (distinct from the cart launcher `#cartFab`) overlaps the product card's `Добавить` control on delivery XS/M. This should be the first focused improvement candidate. Keep order/cart behavior unchanged; adjust only the support FAB collision/placement and add a screenshot regression asserting that `#chatFab` and the product `[data-add]` bounding boxes do not intersect.

## Screenshot register

Keep one row per physical screenshot, even when several screenshots belong to one screen ID.

| Screenshot ID | Screen ID | Commit/build | Brand/role | Viewport | State | Source | Evidence quality | File |
|---|---|---|---|---|---|---|---|---|
| COF-MENU-XS | COF-MENU | f06a94b | coffee / guest-cold-context | 320×740 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `COFFEE-GUEST-INITIAL-GUEST-STATE-XS.png` |
| COF-MENU-M | COF-MENU | f06a94b | coffee / guest-cold-context | 390×844 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `COFFEE-GUEST-INITIAL-GUEST-STATE-M.png` |
| COF-MENU-T | COF-MENU | f06a94b | coffee / guest-cold-context | 768×1024 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `COFFEE-GUEST-INITIAL-GUEST-STATE-T.png` |
| COF-MENU-D | COF-MENU | f06a94b | coffee / guest-cold-context | 1440×900 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `COFFEE-GUEST-INITIAL-GUEST-STATE-D.png` |
| DEL-MENU-XS | DEL-MENU | f06a94b | delivery / guest-cold-context | 320×740 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `DELIVERY-GUEST-INITIAL-GUEST-STATE-XS.png` |
| DEL-MENU-M | DEL-MENU | f06a94b | delivery / guest-cold-context | 390×844 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `DELIVERY-GUEST-INITIAL-GUEST-STATE-M.png` |
| DEL-MENU-D | DEL-MENU | f06a94b | delivery / guest-cold-context | 1440×900 | first-viewport | Playwright CI test server, run 42089915249 | supporting | `DELIVERY-GUEST-INITIAL-GUEST-STATE-D.png` |

| COF-MENU-HYDRATED-D | COF-MENU | d5e1ddc | coffee / guest | 1440×900 | hydrated first viewport | Playwright CI test server, run 42185234269 | supporting | `COFFEE-GUEST-HYDRATED-MENU-VIEWPORT-D.png` |
| DEL-MENU-HYDRATED-D | DEL-MENU | d5e1ddc | delivery / guest | 1440×900 | hydrated first viewport | Playwright CI test server, run 42185234269 | supporting | `DELIVERY-GUEST-HYDRATED-MENU-VIEWPORT-D.png` |
| COF-MENU-FULL-D | COF-MENU | d5e1ddc | coffee / guest | 1440×900 | full-page supplemental | Playwright CI test server, run 42185234269; content-visibility override | supporting only | `COFFEE-GUEST-HYDRATED-MENU-D.png` |
| DEL-MENU-FULL-D | DEL-MENU | d5e1ddc | delivery / guest | 1440×900 | full-page supplemental | Playwright CI test server, run 42185234269; content-visibility override | supporting only | `DELIVERY-GUEST-HYDRATED-MENU-D.png` |

Suggested filename: `<screenshot-id>__<commit-short>__<state>.png`.

## Score register

One row per screen and viewport. Fill scores only after inspecting the matching screenshot. The register covers all 56 screen/viewport combinations. Rows with inspected screenshots carry provisional scores; all others remain unassessed. Do not substitute CI pass/fail for visual review.

| Screen ID | Viewport | Hierarchy | Composition | Typography | Navigation | Actions | Density | Responsive/a11y | Total /10 | Critical finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| COF-HOME | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-HOME | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-HOME | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-HOME | D | — | — | — | — | — | — | — | — | Not assessed |
| COF-MENU | XS | 8 | 7 | 8 | 7.5 | 7.5 | 7 | 7 | 7.5 | Ticker is an intended marquee; support/chat crowded the next card in the pre-#167 capture; test media are placeholders |
| COF-MENU | M | 8 | 7 | 8 | 7.5 | 7 | 7 | 6.5 | 7.4 | Ticker clips horizontally; support/chat FAB crowds second card media |
| COF-MENU | T | 8.5 | 8 | 8.3 | 8 | 7.5 | 8 | 7.8 | 8.1 | Ticker is an intended looping marquee, not static truncation |
| COF-MENU | D | 8.5 | 6.5 | 8.2 | 7.5 | 7 | 7 | 7 | 7.5 | Bonus sign-up card visible; quiet area below is not yet confirmed as a defect |
| COF-ITEM | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-ITEM | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-ITEM | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-ITEM | D | — | — | — | — | — | — | — | — | Not assessed |
| COF-PROFILE | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-PROFILE | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-PROFILE | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-PROFILE | D | — | — | — | — | — | — | — | — | Not assessed |
| COF-BONUS | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-BONUS | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-BONUS | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-BONUS | D | — | — | — | — | — | — | — | — | Not assessed |
| COF-CART | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-CART | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-CART | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-CART | D | — | — | — | — | — | — | — | — | Not assessed |
| COF-CHECKOUT | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-CHECKOUT | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-CHECKOUT | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-CHECKOUT | D | — | — | — | — | — | — | — | — | Not assessed |
| DEL-HOME | XS | — | — | — | — | — | — | — | — | Not assessed |
| DEL-HOME | M | — | — | — | — | — | — | — | — | Not assessed |
| DEL-HOME | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-HOME | D | — | — | — | — | — | — | — | — | Not assessed |
| DEL-MENU | XS | 8 | 6.5 | 7.5 | 6.5 | 5 | 6.5 | 5 | 6.6 | Support/chat FAB (#chatFab) overlaps Add area; top filter chips are cut off |
| DEL-MENU | M | 8 | 6.5 | 7.5 | 6.5 | 5 | 6.5 | 5.5 | 6.6 | Support/chat FAB (#chatFab) covered Add in pre-#167 capture; ingredient filters are horizontally scrollable and ticker is an intended marquee |
| DEL-MENU | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-MENU | D | 8.5 | 7.2 | 8 | 7.5 | 8 | 7 | 7.5 | 7.8 | Profile sign-in card visible; desktop ingredient filters clip; category rail and ingredient filters are not duplicates |
| DEL-ITEM | XS | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ITEM | M | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ITEM | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ITEM | D | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CART | XS | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CART | M | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CART | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CART | D | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CHECKOUT | XS | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CHECKOUT | M | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CHECKOUT | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-CHECKOUT | D | — | — | — | — | — | — | — | — | Not assessed |
| DEL-PROFILE | XS | — | — | — | — | — | — | — | — | Not assessed |
| DEL-PROFILE | M | — | — | — | — | — | — | — | — | Not assessed |
| DEL-PROFILE | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-PROFILE | D | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ORDER | XS | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ORDER | M | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ORDER | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-ORDER | D | — | — | — | — | — | — | — | — | Not assessed |

## Findings ledger

Each finding needs a stable ID and:

- Severity: Blocker / High / Medium / Low.
- Screen ID(s) and screenshot ID(s).
- Observed evidence and reproduction context.
- Why it harms usability, comprehension, trust or visual quality.
- Proposed change and what must remain unchanged.
- Acceptance criteria and a Playwright or manual verification method.
- Before/after score impact.

Do not label a code smell or DOM scrape oddity as a UX defect without user-visible evidence. Keep visual-only work separate from order, pricing, promotion, loyalty, payment, API and database behavior.

## Improvement cycle

1. Freeze the baseline: record commit, source and screenshot set.
2. Review one screen (or one closely related group) at a time.
3. Agree the main issues and target visual direction before coding.
4. Implement one bounded UX concern per PR, based on `pizza`.
5. Run targeted Playwright and the relevant CI gates.
6. Capture the identical screen IDs, viewports, role and states again.
7. Inspect the actual before/after pixels and re-score the same seven dimensions.
8. Record score deltas, unresolved defects and regressions. Do not regenerate snapshots just to make tests green.
9. Only call a screen improved when both usability and visual evidence support the change.

## Evidence and current limitations

- Existing `tests/ui-baseline.spec.js` is a useful regression starting point, but it mixes guest, profile, cashier, dispatcher, admin and support captures and runs against a test server/database. It is not the visual scorecard.
- Existing CI has named feature jobs and artifact uploads. CI artifacts can support component-level review, but seeded data and interaction-specific screenshots must be clearly labeled.
- Firecrawl can capture production pages, but if its browser session cannot establish isolated cold-guest state or its screenshot cannot be retrieved for pixel inspection, mark that evidence preliminary.
- A dedicated Playwright capture lane should create deterministic, isolated guest contexts for both brands, capture first paint and hydrated states, emit screenshot metadata and JSON score-register rows, and upload PNGs as a named artifact. Staff capture remains a separate later workflow.
- No local browser/DevTools access is required from the user when GitHub Actions can run the capture. Do not imply a local interactive browser is attached when it is not.

## Current baseline verdict

**No numeric baseline score is assigned yet.** The first-viewport production subset for COF-HOME and DEL-HOME is now archived and visually reviewed in CI #3064, but the wider inventory (item detail, profile, bonuses, cart, checkout, order states and staff roles) and cold-first-paint comparisons remain pending. Score each row only when its exact state has been captured and reviewed.

## Guardrails

- Base all implementation PRs on `pizza`, never `main`.
- Customer storefront first; staff second.
- No broad visual rewrite before evidence review.
- Preserve existing CLS, accessibility, keyboard/focus, safe-area and checkout contracts.
- No business logic/API/DB/order/discount/loyalty changes in visual-only work.
- Update the screenshot register and score register after each accepted visual PR.


## G. iOS PWA visual-review feedback (390×844 pt)

These items are tracked separately from the numeric score register. A checked item means the bounded implementation PR is merged; it does not imply a new production baseline score.

- [x] **Profile polish** — hint removed, promo action kept on one line, coffee social links distributed across the card, drawer dismissal cleaned up. [PR #177](https://github.com/h0wller/zerno-app/pull/177), merged into `pizza` as `401fa8f`.
- [x] **Mobile support launcher placement** — existing `#chatFab` moved into the active mobile storefront toolbar; this resolves the mobile floating-button collision with product actions. [PR #167](https://github.com/h0wller/zerno-app/pull/167), merged into `pizza` as `52083e2`.
- [ ] **iOS install hint placement** — production guest captures on 2026-11-12 show the fixed `#iosHint` intersecting pizza variant controls at 320×740 and 390×844. Evidence is preliminary because the Firecrawl browser used Chromium with an iPhone Safari user-agent/device emulation, not native iOS Safari. PR #221 adds a Playwright regression and moves the hint into normal flow below the ticker; re-capture and inspect after CI before marking complete.
- [ ] **Support icon/accessibility and stacking** — verify the actual icon and accessible name, plus relative layering against cart/modal overlays wherever the launcher remains fixed (including desktop); these details are not established by the mobile toolbar move alone.
- [ ] **Checkout recipient block** — [PR #179](https://github.com/h0wller/zerno-app/pull/179), draft. Keep profile-derived recipient facts and the existing `POST /api/orders` contract; visual copy must not imply editability that the UI does not provide.
- [ ] **Staff controls placement** — [PR #182](https://github.com/h0wller/zerno-app/pull/182), draft. Candidate behavior: guest menu mode places `#modeSeg` and the single permitted `#editToggle` in the menu-title row; staff work modes return `#modeSeg` to the topbar and `#editToggle` to `#adminBar`. This is the current PR proposal, not merged acceptance. Preserve role gates, keyboard access and hydration reservation.
- [ ] **iOS PWA staff header and controls** — [PR #189](https://github.com/h0wller/zerno-app/pull/189), draft. The supplied iOS captures and the Playwright reproduction confirm a duplicated 47px `--sat` reservation in the staff topbar (107px total instead of the 60px content row). The draft scopes the compact header to staff-only iOS standalone sessions, keeps regular customer safe-area padding intact, aligns `#topbar-actions` in the right grid cell, expands the venue selector to a 52×48px target, keeps promo codes, dashboard and guest chats in three equal compact cells on one row at 320px and 390px, widens the coffee menu role switcher to match delivery, and keeps the support launcher at 44×44px. CI covers both brands at 320×740 and 390×844; final visual verification is pending.
- [ ] Re-capture 320/375/390 px and desktop staff states after the remaining bounded PRs; inspect PNG artifacts before changing scores.

The sequence in the superseded #178 draft is no longer current: #177 and #167 are complete; #179, #182 and the safe-area investigation remain.


## Supporting CI screenshot review — run #3029 (2026-11-13)

**Source:** [visual-ux-baseline-test artifact #14033826340](https://github.com/h0wller/zerno-app/actions/runs/43420027518), head `1dc15e7b018e4eb8f1df24b82ed8c06d5f14d3dd`. Capture source is the isolated Playwright test server (`http://localhost:3000`), not production. Device scale factor 1; each brand has cold, hydrated viewport and supplemental full-page files. This review covers the eight first-viewport hydrated menu screenshots only.

**Visually inspected:** coffee and delivery × 320×740, 390×844, 768×1024, 1440×900.

| Brand | Viewport | Screenshot file | Visual review |
|---|---:|---|---|
| Coffee | 320×740 | `COFFEE-GUEST-HYDRATED-MENU-VIEWPORT-XS.png` | Header, search, category rail, first card and support entry visible; no apparent overlap in first viewport |
| Coffee | 390×844 | `COFFEE-GUEST-HYDRATED-MENU-VIEWPORT-M.png` | One-column hierarchy; card content and following card remain separated |
| Coffee | 768×1024 | `COFFEE-GUEST-HYDRATED-MENU-VIEWPORT-T.png` | Two-column catalog; card text, composition chips and prices readable |
| Coffee | 1440×900 | `COFFEE-GUEST-HYDRATED-MENU-VIEWPORT-D.png` | Three-column catalog, category rail and guest profile prompt fit |
| Delivery | 320×740 | `DELIVERY-GUEST-HYDRATED-MENU-VIEWPORT-XS.png` | One-column pizza card; variant choices remain inside card; page scroll continues below fold |
| Delivery | 390×844 | `DELIVERY-GUEST-HYDRATED-MENU-VIEWPORT-M.png` | One-column card; size/crust choices and Add action are visible without overlap |
| Delivery | 768×1024 | `DELIVERY-GUEST-HYDRATED-MENU-VIEWPORT-T.png` | Two-column cards; ingredient filters remain a horizontal rail; options and Add rows fit |
| Delivery | 1440×900 | `DELIVERY-GUEST-HYDRATED-MENU-VIEWPORT-D.png` | Three-column cards, left category rail and guest profile prompt fit; descriptions and options remain legible |

**Fixture limitations:** CI uses placeholder/fixture imagery and test data. This review does not assess production photography, current live menu content, production guest prompt copy, or the deployed production page. The images are supporting visual-regression evidence only; no numeric production score was changed.

## Production guest runtime inspection — 2026-11-13

**Scope:** first-viewport guest menu only. Source: live production at `https://friday.andcoffee.online/?brand=coffee` and `?brand=delivery`, isolated unauthenticated browser session. The session made no account changes, staff actions, cart submissions, orders or payments.

- Both routes expose the expected root `data-brand` (`coffee` / `delivery`) and `brand-coffee` / `brand-delivery` classes.
- Staff-only controls were not visible in either guest storefront.
- Browser runtime measurements were taken at 320×740, 390×844, 768×1024 and 1440×900 for both brands. At all eight brand/viewport combinations, `documentElement.scrollWidth === clientWidth`; no horizontal overflow was measured.
- The browser reserves a 15px vertical scrollbar (`clientWidth = innerWidth - 15`), which is not horizontal overflow.
- Production first-viewport screenshots at 390×844 were visually inspected for both brands in the earlier isolated browser session. The captured PNGs were not committed as persistent files, so this is supporting visual evidence rather than a completed screenshot archive. The other six viewport combinations have runtime measurements but no individually reviewed production PNGs. A later TinyFish automation attempt (`30fb335e-677a-4ca7-b430-06688a1cd604`) could not set the requested viewport or export PNG; its actual browser viewport was 1007×1007 and its result is explicitly classified incomplete, not baseline evidence.
- Guest install prompt was visible over the lower part of both 390×844 captures. It is recorded as a capture-state observation, not filed as a defect in this tap-target change.

### Runtime-computed typography

Values are computed from visible production DOM elements after `document.fonts.ready`, not inferred from CSS declarations.

| Element | Coffee | Delivery |
|---|---|---|
| Body | Golos Text, 15px / 22.5px, weight 400 | Golos Text, 15px / 22.5px, weight 400 |
| Menu heading | Unbounded, 18px at 320; 19.5px at 390; 24.576px at 768; 36px at 1440, weight 900 | Unbounded, 20px at 320/390; 21.504px at 768; 28px at 1440, weight 800 |
| First card title | Golos Text, 15.5px / 20.15px, weight 700 | Unbounded, 15.5px / 20.15px, weight 700 |
| Description | Golos Text, 12.5px / 18.125px | Golos Text, 12.5px / 18.125px |
| Composition chip | Golos Text, 10.5px, weight 600 | Not present on the first pizza card |
| First visible price | Golos Text, 16px, weight 700 | Option price: 10.5px at 320; 13px at 390/768/1440, weight 800 |
| Search input | Golos Text, 15px; 36px high on mobile | Golos Text, 16px; 36px high on mobile, 44px at 1440 |
| Ticker | system-ui, 12px / 18px, weight 650 | system-ui, 12px / 18px, weight 650 |
| Category control | Golos Text, 9.5px / 10.925px, weight 700 | Unbounded + Golos Text, 9.5px / 10.925px, weight 700 |
| Card radius | 18px | 18px |

### Runtime-computed brand tokens

| Property | Coffee | Delivery |
|---|---|---|
| `--ink` | `#101418` | `#101418` |
| `--line` | `#D8DFE4` | `#E5DACB` |
| `--flame` | `#123A6B` | `#C03B2A` |
| `--panel` | `#F3F8FC` | `#FAF5EE` |
| `--fr-tan` / `--fr-choc` / `--fr-rice` | unset | `#C99E6E` / `#3A2A1C` / `#EFE6D8` |
| `--card-radius` | `18px` | `18px` |

### Production build identity — verified

Production is now tied to an exact Git revision from the deployment record; the earlier cache-version-only conclusion is superseded.

- **Deployment:** [Deploy to Timeweb run #43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619), workflow `.github/workflows/deploy.yml`, `workflow_dispatch`, branch `pizza`.
- **Deployed commit:** `c005b1c6832a5b722c97c43dd7cd525f638c209b` — merge of PR #223, “delivery composition and recommendation state”.
- **Run timestamps:** deploy job started `2026-11-13T07:06:14Z` and completed successfully at `2026-11-13T07:06:40Z`.
- **Server-side confirmation:** job log shows `git reset --hard origin/pizza`, then `HEAD is now at c005b1c6`; `npm ci`, `npm run build:client`, `pm2 reload zerno-app`, and `pm2 status zerno-app` completed. PM2 reported `zerno-app` online.
- **Cache bump:** the same log shows `STATIC_CACHE` and the asset query versions moving from `v646` to `v3553` at `2026-11-13T07:06:35Z`. This is the deployment script's documented `BUILD_NUM=$(git rev-list --count HEAD)` increment, not a standalone Git identifier.
- **Origin cross-check:** the live `/dist/main.bundle.js.map` reports `Last-Modified: Fri, 13 Nov 2026 07:06:35 GMT` and ETag `W/"fc241-1a1d3bac64c"`; the timestamp falls inside the successful deploy. The live `/api/health` endpoint returns `{"ok":true}`.
- **PR relationship:** the deployed SHA is the common ancestor of the current draft head; GitHub compare at PR head `b230f9bc75a9cd30fd2c73071a75aa80174bfe9e` reports the PR branch `docs/brand-system-baseline-2026-11` is 103 commits ahead of `c005b1c...` and 0 behind (comparison at PR head `0e20f2578bc00541d94bd4ce98124fc2c194959f`). The deployed service therefore serves the pre-PR revision, not draft PR #203.
- **Tap-token cross-check:** the deployed `160-05-base-components.css` at `c005b1c...` does not declare `--tap-visual` / `--tap-hit`; the draft head does. This matches the production runtime inspection, where those properties were unset.

Deployment identity is **verified** as `c005b1c6832a5b722c97c43dd7cd525f638c209b`. This does not imply PR #203 has been deployed or accepted.

**Production screenshot evidence:** the earlier browser automation failed to set the requested viewport and export PNGs. This limitation was superseded by the successful Playwright production archive in CI run #3064 below; the exact 1007×1007 attempt remains invalid evidence.



## Latest PR verification and CI screenshot review — 2026-11-13

- Current draft PR head at review time: `b230f9bc75a9cd30fd2c73071a75aa80174bfe9e`.
- [CI Quality Gates #3033](https://github.com/h0wller/zerno-app/actions/runs/43421869883): **13/13 jobs passed**.
  - Cart and checkout: **25 passed**.
  - Responsive UI: **139 passed, 4 skipped**.
  - Mobile Chrome responsive: **102 passed, 4 skipped**.
- Downloaded and inspected the eight hydrated first-viewport PNGs in [CI artifact #14034162976](https://github.com/h0wller/zerno-app/actions/runs/43421869883): coffee and delivery at 320×740, 390×844, 768×1024 and 1440×900. The 320/390 mobile screenshots and 1440 desktop delivery layout were also opened individually at full resolution; no obvious clipping or horizontal spill is visible in this fixture set.
- This artifact is explicitly a localhost Playwright test-server capture. Product photos are fixture/placeholder art and the test profile prompt is fixture content. It is valid for responsive structure review only, not for production visual scoring.
- Historical checkpoint before CI #3064: the Firecrawl browser task could not set viewport/export PNG and the connected Firecrawl account reached its daily credit limit. This was superseded by the exact-viewport Playwright archive in CI #3064 and is no longer an open first-viewport archive blocker.

**Current merge blockers remain:** customer cart/checkout/profile/bonus and staff-role visual states, plus independent review/reconciliation of the PR's broad 49-file diff. The first-viewport production screenshot archive is now complete in run #3064. No merge or deployment is implied by this documentation update.

## Production guest runtime follow-up — 2026-11-13

This follow-up supplements the historical unverified observations in section 6; it does not erase the original text extraction record.

- **Confirmed in isolated guest browser:** `?brand=coffee` exposes `data-brand=coffee` and `brand-coffee`; `?brand=delivery` exposes `data-brand=delivery` and `brand-delivery`. The first visible cards match the active brand (coffee: Espresso; delivery: Margherita).
- **Confirmed in both brands:** staff-only admin/cashier/dispatch controls are not visible in the guest session.
- **Responsive overflow:** at 320×740, 390×844, 768×1024 and 1440×900, the production DOM reported no horizontal overflow in either brand. The browser's 15px vertical scrollbar reduces `clientWidth` relative to `innerWidth`; compare `scrollWidth` to `clientWidth`, not to `innerWidth`.
- **Still unverified:** ticker loop/duplicate semantics, native iOS Safari behavior, the exact dual-brand hidden DOM inventory, delivery-discount eligibility wording, and any customer/staff modal states. Keep those checklist items open until the relevant DOM or screenshots are inspected.
- **Historical evidence limitation (superseded):** the earlier 390×844 captures were not retained and the browser automation attempt could not export images. The successful production Playwright archive in CI #3064 now provides eight retained PNGs plus the manifest; see the following section.


## Production guest screenshot archive and visual review — 2026-11-13

**Production revision:** `c005b1c6832a5b722c97c43dd7cd525f638c209b` (Timeweb deploy run [#43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619)).  
**Capture run:** [CI Quality Gates #3064](https://github.com/h0wller/zerno-app/actions/runs/43427135621), current PR head `d6a4688af26c60a691a2c41de52a5ddcce5784b1`.  
**Dedicated job:** `E2E / Production guest screenshot archive`, passed (**1 test passed**).  
**Archive:** [production-guest-baseline-43427135621.zip](https://github.com/h0wller/zerno-app/actions/runs/43427135621/artifacts/14037897354), artifact ID `14037897354`. It contains eight PNGs and `manifest.json`.

The Playwright test uses fresh, isolated browser contexts, device scale factor 1, blocks service workers, waits for the correct `data-brand`, hydrated non-skeleton cards, `document.fonts.ready` and visible image decoding, then captures the first viewport. Its manifest records that only GET navigation and screenshot capture occurred; no sign-in, clicks, cart actions, orders, payments or data writes were performed.

| Brand | 320×740 | 390×844 | 768×1024 | 1440×900 |
|---|---|---|---|---|
| Coffee | `production-coffee-guest-menu-320x740-c005b1c.png` | `production-coffee-guest-menu-390x844-c005b1c.png` | `production-coffee-guest-menu-768x1024-c005b1c.png` | `production-coffee-guest-menu-1440x900-c005b1c.png` |
| Delivery | `production-delivery-guest-menu-320x740-c005b1c.png` | `production-delivery-guest-menu-390x844-c005b1c.png` | `production-delivery-guest-menu-768x1024-c005b1c.png` | `production-delivery-guest-menu-1440x900-c005b1c.png` |

**Manifest cross-check:** all eight images report the requested exact viewport and `deviceScaleFactor=1`; the coffee route reports `data-brand=coffee` / `brand-coffee`, the delivery route reports `data-brand=delivery` / `brand-delivery`; first cards are Эспрессо and Маргарита respectively; staff-control visibility lists are empty; `scrollWidth === clientWidth` and horizontal overflow is false in every capture.

**Visual review completed:** all eight PNGs were opened individually at native resolution. The expected brand headers, ticker, menu search, category rails and first catalog cards are present. Both storefronts keep their first-card title, description, options/prices (delivery) and first-viewport actions within the viewport layout; the catalog continues vertically as expected. No horizontal spill or obvious clipped card content was observed in the eight images.

**Non-blocking observations for later targeted triage (not scored as defects):**
- Coffee at 320px displays a shortened search placeholder because of the narrow input width; verify that the intended ellipsis/truncation is acceptable.
- The desktop coffee capture shows the expected populated guest profile/login prompt card to the right of the menu; no empty placeholder defect was confirmed.
- Ticker separator glyphs appear as small square marks in the raster captures; verify the source character/font rendering before treating them as a defect.

**Limits of this evidence:** the captures are post-hydration first-viewport menu states, not cold-first-paint snapshots. They do not cover cart, checkout, customer profile/bonuses, order tracking, staff roles, native iOS Safari or Telegram Mini App. Those rows remain pending.

The earlier 1007×1007 browser automation run is superseded for the first-viewport archive by this exact-viewport Playwright capture; it remains explicitly classified as incomplete and is not used as evidence.


## Latest verification refresh — 2026-11-13

- Current PR head: `c63f170513e94d2b8cd6bf4167561492adb99c2f` (commit: test waits for the resolved guest profile state before capture).
- [CI Quality Gates #3078](https://github.com/h0wller/zerno-app/actions/runs/43431777234): **15/15 jobs passed** on this exact head.
- The dedicated production guest screenshot job passed **1/1** and refreshed the eight-PNG archive plus manifest: [artifact #14038748509](https://github.com/h0wller/zerno-app/actions/runs/43431777234/artifacts/14038748509). Production identity remains `c005b1c6832a5b722c97c43dd7cd525f638c209b`; the PR head is test/documentation work and is not deployed.
- Responsive UI: **139 passed, 4 skipped**; Mobile Chrome responsive: **102 passed, 4 skipped**; Cart and checkout: **25 passed**.
- All eight PNGs in the refreshed #3078 archive were individually opened and inspected at native resolution. The manifest confirms the production SHA, brand, guest role, exact viewport, resolved guest profile state, empty staff-control list and no horizontal overflow.
- Remaining scope is unchanged: cold-first-paint vs hydrated comparison, customer cart/checkout/profile/bonus/order states, staff roles, native iOS/Telegram, and independent review/reconciliation of the broad PR diff.


## Documentation-head verification — 2026-11-13

- [CI Quality Gates #3079](https://github.com/h0wller/zerno-app/actions/runs/43434830992) completed successfully on PR head `cf9077a54583135fcd686b91282f9e4c7e1b1b86`: **15/15 jobs passed**.
- Production guest screenshot job passed **1/1** and refreshed the eight-PNG archive plus manifest: [artifact #14043551195](https://github.com/h0wller/zerno-app/actions/runs/43434830992/artifacts/14043551195). All eight images are present in the archive; the manifest records isolated guest contexts, exact viewports, production SHA `c005b1c6832a5b722c97c43dd7cd525f638c209b`, brand identity, resolved guest profile state, no visible staff controls and no horizontal overflow.
- Cart and checkout: **25 passed**; Responsive UI: **139 passed**; Mobile Chrome responsive: **102 passed**.
- The new archive was downloaded and checked: eight PNGs plus `manifest.json`; coffee and delivery 390 px captures and coffee 320 px capture were opened at native resolution. Earlier #3078 archive already had a full eight-image visual review; #3079 refresh confirms the capture is reproducible.
- Evidence remains limited to hydrated guest first viewport. Cold-first-paint comparison, customer cart/checkout/profile/bonus/order states, staff roles, native iOS/Telegram, and full PR scope review remain open.


## Production screenshot verification — CI #3081 — 2026-11-13

- PR documentation head under test: `7ad60aea08badb261083db1353e9cf9d55e93f65`.
- [CI Quality Gates #3081](https://github.com/h0wller/zerno-app/actions/runs/43440569609): **15/15 jobs passed**. Dedicated production screenshot job passed **1/1**.
- Artifact [#14045198271](https://github.com/h0wller/zerno-app/actions/runs/43440569609/artifacts/14045198271) was downloaded and verified to contain eight PNGs and `manifest.json`. Captures: coffee and delivery at 320×740, 390×844, 768×1024 and 1440×900; each at deviceScaleFactor 1.
- Manifest records production revision `c005b1c6832a5b722c97c43dd7cd525f638c209b`, isolated empty browser contexts, guest role, resolved guest profile branch, correct `data-brand`, first card title, no visible staff controls and `scrollWidth === clientWidth` in all eight cases.
- All eight images were opened and inspected individually at native resolution in this review. No horizontal spill or clipped first-card content was observed. Coffee first card: «Эспрессо»; delivery first card: «Маргарита».
- Non-blocking observations remain: the ticker separator renders as a small square glyph in both themes; coffee search placeholder is shortened at 320 px. The desktop coffee auxiliary card is a populated «Профиль по номеру телефона» guest prompt, not an empty placeholder. No defect is declared from these observations alone.
- Evidence is the hydrated first viewport, not a cold-first-paint comparison and not coverage for customer cart/checkout/profile/bonus/order states, staff roles, native iOS Safari or Telegram Mini App.
