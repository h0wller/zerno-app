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
| COF-MENU · 320×740 | 7.5 | Header/ticker clipping; floating loyalty control crowds the next card |
| COF-MENU · 390×844 | 7.4 | Ticker clips; floating loyalty control crowds card media |
| COF-MENU · 768×1024 | 8.1 | Better two-column balance; ticker still clips |
| COF-MENU · 1440×900 | 7.5 | Menu is readable, but a large unused right-side area weakens composition |
| DEL-MENU · 320×740 | 6.6 | Floating cart action obscures the Add area; horizontal filter chips are clipped |
| DEL-MENU · 390×844 | 6.6 | Floating cart action overlaps the Add button; filter chips and ticker clip |
| DEL-MENU · 1440×900 | 7.8 | Product selection controls are clear; empty right column and duplicate category navigation reduce balance |

These are provisional screen scores for the rendered CI state, not product acceptance scores. Replace/reconfirm them with the production capture before considering the baseline frozen. The seven component scores are recorded in the score register above.

### Screenshot evidence inspected

| Screenshot ID | Viewport | Capture state | Evidence notes |
|---|---:|---|---|
| COF-MENU-XS | 320×740 | Guest first viewport | Header, ticker, rail, search and first card inspected |
| COF-MENU-M | 390×844 | Guest first viewport | Header, ticker, rail, search and card overlay inspected |
| COF-MENU-T | 768×1024 | Guest first viewport | Two-column menu and navigation inspected |
| COF-MENU-D | 1440×900 | Guest first viewport | Three-column catalog and right-side panel inspected |
| DEL-MENU-XS | 320×740 | Guest first viewport | Filter clipping and floating cart/Add overlap inspected |
| DEL-MENU-M | 390×844 | Guest first viewport | Floating cart button visibly covers part of the Add control |
| DEL-MENU-D | 1440×900 | Guest first viewport | Three-column cards, duplicate category navigation and right-side area inspected |

Artifact: `visual-ux-baseline-test-42089915249.zip` (GitHub Actions run `42089915249`). It contains 16 viewport PNGs and 8 state metadata JSON files. The full-page hydrated catalog PNGs are supplementary; score rows above use first-viewport captures at the same viewport.

**First confirmed UX finding from the test screenshots:** on delivery XS/M, the fixed cart floating action overlaps the product card's Add control. This should be the first focused improvement candidate. Keep order/cart logic unchanged; adjust only the visual collision/available space and add a screenshot regression asserting that the two bounding boxes do not intersect.

## Screenshot register

Keep one row per physical screenshot, even when several screenshots belong to one screen ID.

| Screenshot ID | Screen ID | Commit/build | Brand/role | Viewport | State | Source | Evidence quality | File |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

Suggested filename: `<screenshot-id>__<commit-short>__<state>.png`.

## Score register

One row per screen and viewport. Fill scores only after inspecting the matching screenshot. All 56 baseline cells start unassessed; do not substitute CI pass/fail for visual review.

| Screen ID | Viewport | Hierarchy | Composition | Typography | Navigation | Actions | Density | Responsive/a11y | Total /10 | Critical finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| COF-HOME | XS | — | — | — | — | — | — | — | — | Not assessed |
| COF-HOME | M | — | — | — | — | — | — | — | — | Not assessed |
| COF-HOME | T | — | — | — | — | — | — | — | — | Not assessed |
| COF-HOME | D | — | — | — | — | — | — | — | — | Not assessed |
| COF-MENU | XS | 8 | 7 | 8 | 7.5 | 7.5 | 7 | 7 | 7.5 | Ticker text clipped at right edge; test media are placeholders |
| COF-MENU | M | 8 | 7 | 8 | 7.5 | 7 | 7 | 6.5 | 7.4 | Ticker clips horizontally; floating loyalty action crowds second card media |
| COF-MENU | T | 8.5 | 8 | 8.3 | 8 | 7.5 | 8 | 7.8 | 8.1 | Ticker content clipped at right edge |
| COF-MENU | D | 8.5 | 6.5 | 8.2 | 7.5 | 7 | 7 | 7 | 7.5 | Wide unused right-side area weakens overall composition |
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
| DEL-MENU | XS | 8 | 6.5 | 7.5 | 6.5 | 5 | 6.5 | 5 | 6.6 | Floating cart action overlaps Add area; top filter chips are cut off |
| DEL-MENU | M | 8 | 6.5 | 7.5 | 6.5 | 5 | 6.5 | 5.5 | 6.6 | Floating cart action covers part of Add button; filter chips and ticker clip |
| DEL-MENU | T | — | — | — | — | — | — | — | — | Not assessed |
| DEL-MENU | D | 8.5 | 7.2 | 8 | 7.5 | 8 | 7 | 7.5 | 7.8 | Empty right-side profile column; top filters and left category rail duplicate navigation |
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

**No numeric baseline score is assigned yet.** The current evidence collection includes successful CI runs and preliminary production scrapes, but not a fully isolated, pixel-inspected production screenshot set covering the agreed viewports and states. Numeric scores will be entered only after that screenshot set is available and inspected.

## Guardrails

- Base all implementation PRs on `pizza`, never `main`.
- Customer storefront first; staff second.
- No broad visual rewrite before evidence review.
- Preserve existing CLS, accessibility, keyboard/focus, safe-area and checkout contracts.
- No business logic/API/DB/order/discount/loyalty changes in visual-only work.
- Update the screenshot register and score register after each accepted visual PR.
