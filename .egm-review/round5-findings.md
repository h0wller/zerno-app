# EGM Review Loop — Round 5

**Reviewed PR:** [#92](https://github.com/h0wller/zerno-app/pull/92)  
**Reviewed HEAD:** `51f94fce3944022a01e3cfaea11520969530e119`  
**Base:** `pizza` at `30f5018c`  
**CI:** [Run #1245](https://github.com/h0wller/zerno-app/actions/runs/41238164154) — failed  
**Scope:** review only; no production files changed.

## Verdict

**PR is not ready to merge.** Static quality gates passed, but the remaining E2E suite finished with **382 passed, 8 skipped, 4 failed**. The four failures are two scenarios repeated in Chromium and Mobile Chrome:

- cross-tab auth test — its mocked `/api/me` response is bypassed by the Service Worker;
- coffee header geometry — 690 px layout moves by 4 px when deferred CSS arrives.

One P1 remains: the tracked production bundle does not contain the current auth-session implementation, even though a correct build artifact was generated in CI.

## P1-1 — Tracked production bundle is semantically stale

**Evidence**

- Source `public/app/core/auth-session.js` now handles `zt_user` and `zt_role` storage events by clearing provisional layout state and reloading so `boot()` can revalidate the token through `/api/me`.
- The tracked `public/dist/main.bundle.js` still contains the older storage handler. It only reads the current token/role and toggles `data-staff-role`; it does not perform the new role-change revalidation flow. The presence of marker strings such as `zt_role` and `data-staff-ready` is therefore not a sufficient bundle check.
- Tracked `public/sw.js` and `public/index.html` remain at cache/asset version **v612**.
- The `built-client-output` artifact from Run #1245 was generated from this HEAD and contains the current storage handler; its `sw.js` and bundle URL are **v613**.
- The workflow's `sync-built-client` job was skipped because the Playwright job failed.

**Impact**

A deployment using the tracked files would serve stale client behavior and keep using the old bundle URL/cache key. The source-level cross-tab fix is not yet what the checked-in production client executes.

**Required**

First make the E2E run green, then allow the existing sync job to commit the exact tested build output. Verify the tracked bundle's storage handler semantically, not just by checking for three marker strings; verify that `index.html`, `sw.js`, and the bundle query version advance together.

## P2-1 — The 8-second staff-hint watchdog races a slow auth request

**Evidence**

- `public/index.html:29-42` applies the cached role and unconditionally removes it after 8 seconds while `data-staff-ready` is absent.
- `public/app/core/boot.js:74-95` awaits `api('/me')` before setting the ready state and final role.
- `public/app/core/ui.js` performs `fetch()` without an abort/timeout bound.
- The current staff-layout E2E delays `/api/me` by 3 seconds; it does not cover a response that remains pending beyond the 8-second watchdog.

**Failure mode**

If `/api/me` takes longer than 8 seconds and later succeeds, the watchdog removes the reservation first; the successful response then restores the staff role and reserved row. This creates a delayed CLS spike on slow networks. Merely increasing the watchdog to 15 seconds moves the threshold; it does not distinguish a bundle that never ran from an auth request that is still pending.

**Required**

Separate app-started, auth-pending, and auth-settled state. Give the `/api/me` bootstrap request a bounded timeout/abort path; only release the provisional layout when the app failed to start or auth has definitively failed/timed out. Add a deterministic regression where `/api/me` remains pending past the old watchdog threshold and then resolves.

## P2-2 — Mobile critical CSS omits the fixed geometry of #mbonusBtn

**Evidence**

- Final positioning is owned by `public/app/ui/theme/160-02-addr-panel-fix.css` in `body #mbonusBtn`: fixed at the lower left, 56 × 56 px, with its own z-index.
- The critical header CSS in `public/index.html` reserves the venue, wordmark, and profile controls but has no equivalent mobile positioning for `#mbonusBtn`.
- Before deferred theme CSS, `#mbonusBtn` remains an in-flow grid item and its bean SVG expands dramatically. The Playwright screencast shows the oversized black bean over the header before CSS; after CSS it becomes the compact lower-left bonus badge.
- At 690 px the CI geometry log changes from a 44 px first grid row plus a 246 px implicit second row to a single 52 px row. The venue/brand/profile controls all move down 4 px.

**Required**

Mirror only the mobile geometry of `body #mbonusBtn` in critical CSS (fixed positioning, left/bottom offsets, fixed 56 × 56 size, and stacking order), leaving visual styling in the theme stylesheet. Keep the existing 1 px geometry assertion and verify 320, 390, 520, and 690 px.

## P2-3 — Cross-tab test mock is bypassed by the Service Worker

**Evidence**

`tests/registration.spec.js` installs a `page.route()` handler for `/api/me`, then reloads the page after the other tab changes storage. The reloaded page is controlled by the Service Worker; the request reaches the test server instead of the route mock and receives 401. The test therefore times out waiting for the mocked request in both Chromium and Mobile Chrome.

**Required**

Disable Service Workers for this test's browser context (preferably in a nested Playwright describe so unrelated auth tests keep their normal environment). Keep the route scoped to `/api/me`. This is a test-isolation correction; the observed failure does not by itself establish a production auth defect.

## P3-1 — Responsive image-priority test can pass with zero images

`tests/slow-network-layout.spec.js` computes expected eager/high-priority counts from the image-bearing cards it happens to find. The resize test does not guarantee that at least one valid image-bearing card exists; with `firstRowImages.length === 0`, the expected values become eager=0 and high=0 and the test passes without exercising the behavior.

Seed or route a deterministic valid image in the resize test and assert that the first row contains at least one image at every tested width. Keep the existing first-card-preservation test as a separate contract.

## P3-2 — CI diagnostics artifact is oversized

Run #1245 uploads a **118,125,591-byte** `playwright-diagnostics` artifact (59 files, 7-day retention). Several large trace archives are included. Keep only the diagnostic traces/screenshots needed to debug failed tests, or reduce retention/duplicates.

## P3-3 — The production-asset sync job is tied to PR number 92

`.github/workflows/ci.yml` only runs `sync-built-client` when `github.event.pull_request.number == 92`. This is acceptable as a one-off migration for this PR, but it is not a reusable release rule. Before reusing the workflow for future client-source PRs, replace the numeric PR guard with an explicit label/branch policy or a repository-owned workflow condition.

## Round 4 findings re-check

- The old P1 wording that the bundle contained **zero** staff-role markers is outdated. The markers exist; the current problem is that the tracked bundle's storage-handler behavior is stale relative to source.
- The claim that `storage` with `newValue === null` is not invalidated is not supported by current source. For a missing token, the handler clears `data-staff-role` and sets `data-staff-ready`; with a token still present, it removes provisional state and reloads for `/api/me` revalidation.
- The claim that three modules independently parse `zt_role` is not supported. The early read is in `index.html`; `boot.js` and `auth-session.js` write/remove the hint, and `ui.js` clears it on fallback auth failure. A shared parser abstraction is not justified by the current code.

## Merge gate

Do not merge until the two failing E2E scenarios pass, the watchdog behavior is bounded/tested, the mobile critical header geometry is stable, and the tested v613 client artifact is committed to the PR.
