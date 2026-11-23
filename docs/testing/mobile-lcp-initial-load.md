# Mobile first-load LCP — C8 contract and verification

**Updated:** 2026-11-23  
**Implementation PRs:** [#300 — guest C8 and image preload](https://github.com/h0wller/zerno-app/pull/300); [#308 — authenticated coffee first paint](https://github.com/h0wller/zerno-app/pull/308)  
**Base:** `pizza` at `e9855638031b5df9c66ea28d3b208409981afce3`  
**Verified PR HEAD:** `57cfab5d333e2812eb4e7952bf9be4ac9e9cac73`  
**Status:** PR #300 C8 work remains Draft with production visual acceptance open. PR #308 boot-order change and regression coverage passed its matched CI/Lighthouse run on `57cfab5`; production-asset visual acceptance and field verification remain open. PR #308 stays Draft.

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

### Authenticated coffee startup

When the selected brand is coffee and the splash is not pending, `boot.js` starts the public `/api/menu` request before awaiting `verifyStaffSession()`. The existing `core/catalog.js` loader renders this active public list into the coffee grid as soon as the response is ready; it remains the only owner of coffee menu data. This does not trust `zt_role` or any other client-side role hint.

After `/api/me` resolves:
- guests and non-staff users keep the public menu and do not make a duplicate request;
- a confirmed cashier, dispatcher or admin waits for the public request to settle, then uses the same loader to fetch guarded `/api/menu/all`; the full result updates `MENU` without replacing the already-painted first catalog DOM during boot, and later ordinary menu renders (for example, entering edit mode) use the full list;
- if the early public request fails, boot retries through the role-aware loader after session verification.

A pending brand splash does not start a speculative runtime catalog request. Its selected-brand flow remains owned by `splash.js`. The staff endpoint is never requested before the server confirms the role.

### Explicit-brand document preload

The middleware in `server.js` adds an HTTP `Link: rel=preload; as=image; fetchpriority=high` header for `GET /` only when the request explicitly selects a brand (`?brand=coffee` or `?brand=delivery`) or uses the deterministic Lighthouse/clean audit input. It selects the first active image in the initial visible category; for delivery this is the first active `pizza`, not the first database row if sauces/add-ons sort earlier.

Only local `/media/dishes/` images are eligible. Responsive `imagesrcset` / `imagesizes` are added when available. A plain no-query splash does not receive a server-selected brand image preload.

### Audit input

`public/app/core/state.js` makes `?lighthouse=1` and `?clean=1` deterministic: no explicit delivery query means coffee. An explicit `brand=delivery` selects delivery. Audit inputs do not overwrite the visitor's stored `zt_brand`.

## 2. Ownership

- `public/index.html`: early bootstrap, speculative request, image preload and the bridges `window.__ztPrimeMenuLcp` / `window.__ztApplyDeliveryHero`. The document shell may prime the first delivery hero before the bundle is ready.
- `server.js`: document-level `Link` preload for explicitly selected brands and audit requests; local media filtering and responsive image parameters.
- `public/app/core/state.js`: deterministic audit brand initialization.
- `public/app/core/boot.js`: sequences selected-brand catalog preload with `/api/me`; coffee's public catalog can paint while staff auth is pending, then staff roles upgrade to the guarded full list.
- `public/app/core/catalog.js`: remains the sole owner of coffee menu data and loads `/api/menu` or `/api/menu/all` according to the server-verified `me` role; `menu.js` remains the sole owner of `#grid` DOM. `boot.js` skips only its redundant final `renderMenu()` when the early coffee catalog has already painted.
- `public/app/menu.js` and `public/app/delivery.js`: catalog DOM/render ownership and first-row image priority after hydration. These modules remain the owners of their respective catalogs; the early document bootstrap is not a second catalog renderer.
- `docs/module-map.md`: canonical module-to-DOM ownership map.

## 3. Automated verification

Verified on PR HEAD `57cfab5d333e2812eb4e7952bf9be4ac9e9cac73`:

- Test-first regression reproduced the original defect: with `/api/me` held, the first coffee catalog card did not exist.
- `tests/mobile-lcp.spec.js` now covers the first coffee card appearing while `/api/me` is pending, staff upgrade to guarded `/api/menu/all` without replacing the first-card DOM, offline/503 session verification, and switching away from coffee while its catalog request is in flight.
- The isolated Menu and search job passed **102 expected / 0 unexpected / 0 flaky**.
- The final current-head CI result is tracked in [run 4804](https://github.com/h0wller/zerno-app/actions/runs/45156207212). The run includes Quality Gate, all browser/E2E groups and matched Lighthouse; see the live run summary for the final Mobile Chrome responsive job status.
- The staff Lighthouse fixture uses a valid customer ID and a server-verifiable admin session. It verifies `/api/me` before the audit and records no staff token in the report artifact.

The CI visual captures use isolated test fixtures. They verify layout and browser behavior, but they are not production-asset visual acceptance.

## 4. Lighthouse evidence and interpretation

Latest matched comparison: CI [run 4804](https://github.com/h0wller/zerno-app/actions/runs/45156207212), artifact `lighthouse-mobile-lcp-45156207212`. Baseline `e9855638031b5df9c66ea28d3b208409981afce3`; PR HEAD `57cfab5d333e2812eb4e7952bf9be4ac9e9cac73`.

Lighthouse 13.5.0, mobile 360×800, RTT 150 ms, throughput 1638.4 Kbps, CPU slowdown ×4. There were **two repeats per baseline/PR × brand combination**; medians are preliminary lab evidence, not a statistically strong result or real-user field data. The LCP candidates were the first product image in each catalog: coffee `Эспрессо` and delivery `Маргарита`.

| Observed trace metric | Coffee baseline | Coffee PR | Delivery baseline | Delivery PR |
| --- | ---: | ---: | ---: | ---: |
| LCP median, ms | 489 | 500 | 531.5 | 423.5 |
| Change vs baseline | — | **+11 ms (+2.2%)** | — | **−108 ms (−20.3%)** |
| Simulated LCP median, ms | 4900.7 | 4843.3 | 5537.6 | 5317.6 |
| Simulated change | — | **−57.4 ms (−1.2%)** | — | **−219.9 ms (−4.0%)** |

Interpretation:
- The runtime change demonstrably starts the public coffee menu request before staff-session verification and the test proves the real coffee card can paint while `/api/me` is unresolved.
- This matched run does **not** demonstrate an observed LCP improvement for coffee: its two-run median is 11 ms slower on the PR head. The simulated median is 57 ms faster, too small and too noisy to establish a meaningful effect with two repetitions.
- Delivery's observed and simulated medians are faster in this run, but this is a separate catalog and not evidence that the coffee change improved delivery.
- Observed trace LCP and simulated Lighthouse LCP are distinct measures and must not be mixed.
- Production captures from 2026-11-22 used older bundles (`v=4177` for the coffee capture and `v=4198` for a later delivery trace) and different conditions. They are diagnostic context, not a matched before/after result for this PR.

Do not present this two-repeat lab result as a field improvement. A same-version authenticated production comparison or post-deployment field measurement remains outstanding.


### PR #308: current boot-order verification

- Current branch head at this report update: `57cfab5d333e2812eb4e7952bf9be4ac9e9cac73`.
- Matched lab report: [CI run 4804](https://github.com/h0wller/zerno-app/actions/runs/45156207212), artifact `lighthouse-mobile-lcp-45156207212`.
- Public coffee menu fetch begins during `/api/me`; verified staff role triggers guarded `/api/menu/all` only after server confirmation.
- Regression tests include session-verification failure and late response after brand switch. Menu and search artifact for run 4804: `playwright-Menu and search-45156207212`.
- PR #308 remains Draft: do not merge until live CI is fully green and the production-asset same-context visual acceptance in §6 is completed.

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
