# Mobile first-load LCP — C8 contract and verification

**Updated:** 2026-11-22  
**Implementation PR:** [#300 — perf: improve mobile first-load LCP](https://github.com/h0wller/zerno-app/pull/300)  
**Base:** `pizza` at `aa3a958291948a7b2eda04bcbc9c3cf34385b4aa`  
**Verified PR HEAD:** `8db36bf3bf9d82adf5ae3cb89f0628afda168201`  
**Status:** C8 implementation, temporary-file cleanup and automated verification complete; production visual acceptance remains open. PR #300 stays Draft.

This document supersedes earlier performance snapshots for the final C8 implementation. It does not turn lab measurements into production field data.

## 1. Runtime contract

### Guest splash prediction

The early bootstrap in `public/index.html#zt-lcp-head` may start one speculative catalog request only when all conditions are true:

- the brand splash is currently pending;
- `localStorage.zt_user` is empty (guest);
- `localStorage.zt_brand` is exactly `coffee` or `delivery`.

It requests the saved brand's catalog JSON (`/api/menu` or `/api/dmenu`) and, after a successful response, preloads the first active image in the initial visible category (`coffee` or `pizza`). It does not guess a brand when no valid saved brand exists and does not predict for an authenticated user.

When the user chooses the same brand, `window.__ztPrimeMenuLcp` reuses the speculative response for the selected catalog request. If the saved brand differs from the choice, the selected brand uses its own request. A prediction that completes after another brand has been selected must not create a hidden-brand preload or call `window.__ztApplyDeliveryHero`. If a speculative request fails (HTTP 503 or network abort), selection falls back to an ordinary request for the selected brand.

A mismatch that finishes before the user makes a choice may already have preloaded the saved brand's first image. This is the explicit C8 trade-off: the measured candidate's mistaken prediction cost was about **22.5 KiB for coffee** or **49.6 KiB for delivery**. These are measured fixture bytes, not a universal upper bound for every production menu.

### Explicit-brand document preload

The middleware in `server.js` adds an HTTP `Link: rel=preload; as=image; fetchpriority=high` header for `GET /` only when the request explicitly selects a brand (`?brand=coffee` or `?brand=delivery`) or uses the deterministic Lighthouse/clean audit input. It selects the first active image in the initial visible category; for delivery this is the first active `pizza`, not the first database row if sauces/add-ons sort earlier.

Only local `/media/dishes/` images are eligible. Responsive `imagesrcset` / `imagesizes` are added when available. A plain no-query splash does not receive a server-selected brand image preload.

### Audit input

`public/app/core/state.js` makes `?lighthouse=1` and `?clean=1` deterministic: no explicit delivery query means coffee. An explicit `brand=delivery` selects delivery. Audit inputs do not overwrite the visitor's stored `zt_brand`.

## 2. Ownership

- `public/index.html`: early bootstrap, speculative request, image preload and the bridges `window.__ztPrimeMenuLcp` / `window.__ztApplyDeliveryHero`. The document shell may prime the first delivery hero before the bundle is ready.
- `server.js`: document-level `Link` preload for explicitly selected brands and audit requests; local media filtering and responsive image parameters.
- `public/app/core/state.js`: deterministic audit brand initialization.
- `public/app/menu.js` and `public/app/delivery.js`: catalog DOM/render ownership and first-row image priority after hydration. These modules remain the owners of their respective catalogs; the early document bootstrap is not a second catalog renderer.
- `docs/module-map.md`: canonical module-to-DOM ownership map.

## 3. Automated verification

Verified on PR HEAD `8db36bf3bf9d82adf5ae3cb89f0628afda168201`:

- `npm run lint:code`: 0 errors; 10 existing warnings in untouched code.
- `node --check` for the inline bootstrap and the targeted Playwright/integration files: passed.
- `tests/integration/mobile-lcp-link-preload.test.mjs`: 13/13.
- Unit/integration suite: 205/205.
- `tests/mobile-lcp.spec.js`: 21/21.
- GitHub Actions [run 45030665869](https://github.com/h0wller/zerno-app/actions/runs/45030665869): **14/14 jobs successful**. Mobile Chrome responsive reported 229 passed, 4 skipped, 0 failures/timeouts.

The CI visual captures use isolated test fixtures. They verify layout and browser behavior, but they are not production-asset visual acceptance.

## 4. Lighthouse evidence and interpretation

Latest comparison: CI [run 45030665869](https://github.com/h0wller/zerno-app/actions/runs/45030665869), artifact `lighthouse-mobile-lcp-45030665869`. Baseline `aa3a958291948a7b2eda04bcbc9c3cf34385b4aa`; PR HEAD `8db36bf3bf9d82adf5ae3cb89f0628afda168201`.

Lighthouse 13.5.0, mobile 360×800, RTT 150 ms, throughput 1638.4 Kbps, CPU slowdown ×4. There were **two repeats per baseline/PR × brand combination**; treat the medians as preliminary lab evidence, not a statistically strong result or real-user field data.

| Observed trace metric | Coffee baseline | Coffee PR | Delivery baseline | Delivery PR |
| --- | ---: | ---: | ---: | ---: |
| LCP median, ms | 589.5 | **559** | 490 | **332.5** |
| Resource load delay, ms | 282.3 | **45.3** | 36.7 | 40.9 |
| Element render delay, ms | 290.4 | 501.4 | 438.7 | **274.4** |
| CLS | 0 | 0 | 0 | 0 |

Observed trace LCP changed by **−30.5 ms (−5.2%) for coffee** and **−157.5 ms (−32.1%) for delivery**. These improvements do not mean every performance metric improved:

- Simulated Lighthouse LCP: coffee 4745 → 4639 ms (−106 ms); delivery 5067 → 5156 ms (+89 ms). Delivery regressed on this simulated metric.
- Coffee element-render delay increased by about 211 ms; delivery resource-load delay increased by about 4 ms.
- Observed trace LCP (~0.3–0.6 s) and simulated Lighthouse LCP (~4.6–5.2 s) are different measurements and must not be mixed.

The approved five-run A/F/C8 latency series measured a **preceding C8 candidate**. The bootstrap was subsequently restored and corrected incrementally; the final HEAD passed functional tests, but the latency series was not repeated. Therefore those candidate click-to-card timings are not a verified latency result for this final HEAD. No additional benchmark series was started after the accepted measurements.

## 5. Temporary experiment cleanup

The final branch tree no longer contains:

- `scripts/perf-exp/`;
- `scripts/splash-series.mjs`;
- temporary Lighthouse variant JSON/patch files;
- the C7-specific regression helper/job;
- one-shot C8 patch payloads and helper workflow files.

The `perf-exp` branch itself was not deleted and Git history was not rewritten. The retained `scripts/lighthouse-fixture.mjs`, `scripts/lighthouse-summary.mjs` and `tests/unit/lighthouse-summary.test.mjs` support the current reproducible CI comparison; they are not temporary one-shot helpers.

## 6. Remaining acceptance gate

PR #300 remains Draft. Before it can be considered ready for merge, complete and record the visual acceptance required by `PROJECT_RULES.md §10`:

- capture baseline and after screenshots in the same environment/data context, for both `coffee` and `delivery`;
- cover guest splash before selection and the first frame after selection for both brands;
- inspect mobile portrait, mobile landscape, short landscape and a desktop control viewport;
- inspect first-row cards/images, delivery hero, scrolled catalog and horizontal category rail;
- cover guest and relevant staff roles, plus open menus/dialogs/overlays, cart and checkout;
- inspect address/search with the on-screen keyboard, focus, safe area, overflow, computed geometry and hit targets;
- record the exact SHA, source, role, brand, viewport, state, screenshot actually opened, and `accepted` / `changes requested` / `not reviewed` for each required frame.

Production assets and a real production deployment have not been visually accepted in this PR. CI screenshots do not close this gate. Do not merge or deploy on the basis of this document or green CI alone.
