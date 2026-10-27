# Perf report — 2026-10-03T18:19:58.654Z

## Stale artifacts
- files: 78   size: 2.81 MiB

## SVG
- before: 204.1 KiB   after: 203.8 KiB
- saved:  0.1%

- **public\friday-logo.svg** = 201.6 KiB (svgo −0.0%)

## Rasterized WebP
(запустите rasterize --write)

## Thrash candidates: 17
- `public\app\admin-extra.js:41`  scrollWidth → write @43
- `public\app\chat.js:23`  scrollTop → write @28
- `public\app\core\address-autocomplete.js:23`  getBoundingClientRect → write @24
- `public\app\core\swipe.js:16`  getBoundingClientRect → write @18
- `public\app\core\views.js:18`  getBoundingClientRect → write @22
- `public\app\core\views.js:596`  getComputedStyle → write @597
- `public\app\core\views.js:598`  offsetWidth → write @599
- `public\app\core\views.js:622`  getBoundingClientRect → write @623
- `public\app\ui\scrolltop.js:18`  offsetHeight → write @19
- `public\app\ui\scrolltop.js:25`  getComputedStyle → write @28
- `public\app\ui\scrolltop.js:26`  getBoundingClientRect → write @28
- `public\app\ui\scrolltop.js:27`  getBoundingClientRect → write @28
- `public\app\ui\scrolltop.js:102`  scrollTop → write @105
- `public\app\ui\scrolltop.js:103`  scrollTop → write @105
- `public\app\ui\scrolltop.js:104`  scrollTop → write @105
- `public\app\ui\scrolltop.js:108`  scrollTop → write @110
- `public\app\ui\scrolltop.js:117`  scrollTop → write @118

## Manual
1. `catalog.js::setMode` → `window.__ztLoadRole(m)`.
2. `STATIC_CACHE` в `sw.js` +1.
3. `theme-v2.css` — split на critical + rest (`media="print" onload`).
