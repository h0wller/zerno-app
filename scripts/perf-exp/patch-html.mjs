/* Benchmark-only response patch. Never writes catalog DOM nodes. */
export function patchHtmlDocument(html, variant) {
  if (!['A', 'C7', 'C8', 'C9'].includes(variant)) throw new Error('Unknown variant: ' + variant);
  if (variant === 'A') return html;
  const enableImagePreload = variant === 'C8' || variant === 'C9';
  const pendingMarker = '      var pending = null;';
  if (!html.includes(pendingMarker)) throw new Error('perf-exp: zt-lcp-head pending marker not found');

  const early = [
    '      // PERF-EXP ' + variant + ': fetch selected-brand JSON while splash is visible.',
    '      // C8/C9 add one head-owned image preload only after a successful JSON response.',
    '      var earlyCatalog = null;',
    '      try {',
    '        if (window.__brandSplashPending === true && !localStorage.getItem("zt_user")) {',
    '          var predictedBrand = localStorage.getItem("zt_brand")' + (variant === "C9" ? ' || "coffee"' : "") + ';',
    '          if (predictedBrand === "coffee" || predictedBrand === "delivery") {',
    '            var predictedEndpoint = predictedBrand === "delivery" ? "/api/dmenu" : "/api/menu";',
    '            var earlyPromise = nativeFetch.call(window, predictedEndpoint, { headers: { Accept: "application/json" } }).then(function (response) {',
    '              if (!response || !response.ok) throw new Error("early menu HTTP failure");',
    '              return response.clone().json().then(function (payload) {',
    enableImagePreload ? [
      '                var items = payload && Array.isArray(payload.items) ? payload.items : [];',
      '                var initialCategory = predictedBrand === "delivery" ? "pizza" : "coffee";',
      '                var first = items.find(function (item) { return item && item.on && item.img && item.cat === initialCategory; });',
      '                if (!first) throw new Error("early menu has no active first image");',
      '                var preloadId = predictedBrand === "delivery" ? "zt-delivery-lcp-preload" : "zt-menu-lcp-preload";',
      '                var existingPreload = document.getElementById(preloadId);',
      '                var expectedHref = new URL(first.img, location.href).href;',
      '                var existingHref = existingPreload ? new URL(existingPreload.href, location.href).href : "";',
      '                if (!existingPreload || existingHref !== expectedHref) {',
      '                  if (existingPreload) existingPreload.remove();',
      '                  var preload = document.createElement("link");',
      '                  preload.id = preloadId;',
      '                  preload.rel = "preload";',
      '                  preload.as = "image";',
      '                  preload.href = first.img;',
      '                  preload.type = "image/webp";',
      '                  preload.setAttribute("fetchpriority", "high");',
      '                  if (first.imgSrcset) {',
      '                    preload.setAttribute("imagesrcset", first.imgSrcset);',
      '                    preload.setAttribute("imagesizes", imageSizes);',
      '                  }',
      '                  document.head.appendChild(preload);',
      '                }',
    ].join('\n') : '',
    '                return response;',
    '              });',
    '            });',
    '            earlyCatalog = { brand: predictedBrand, endpoint: predictedEndpoint, promise: earlyPromise };',
    '            window.__ztPerfExpEarlyCatalog = earlyCatalog;',
    '          }',
    '        }',
    '      } catch (_) {}',
  ].join('\n');
  html = html.replace(pendingMarker, pendingMarker + '\n' + early);

  const requestMarker = [
    '        var promise = nativeFetch.call(window, endpoint, {',
    '          headers: { Accept: \'application/json\' }',
    '        }).then(function (response) {',
  ].join('\n');
  const requestReplacement = [
    '        var reusable = earlyCatalog && earlyCatalog.brand === brand ? earlyCatalog.promise : null;',
    '        if (reusable) { earlyCatalog = null; window.__ztPerfExpEarlyCatalog = null; }',
    '        var sourcePromise = reusable',
    '          ? reusable.then(function (response) {',
    '              if (!response || !response.ok) throw new Error("early menu response is not usable");',
    '              return response;',
    '            }).catch(function () {',
    '              // Retry the ordinary selected-brand request after the user chooses.',
    '              return nativeFetch.call(window, endpoint, { headers: { Accept: "application/json" } });',
    '            })',
    '          : nativeFetch.call(window, endpoint, { headers: { Accept: "application/json" } });',
    '        var promise = sourcePromise.then(function (response) {',
  ].join('\n');
  if (!html.includes(requestMarker)) throw new Error('perf-exp: selected-menu request marker not found');
  html = html.replace(requestMarker, requestReplacement);

  const preloadBlock = [
    '              var existing = document.getElementById(id);',
    '              if (existing) existing.remove();',
    '              var preload = document.createElement(\'link\');',
    '              preload.id = id;',
    '              preload.rel = \'preload\';',
    '              preload.as = \'image\';',
    '              preload.href = first.img;',
    '              preload.type = \'image/webp\';',
    '              preload.setAttribute(\'fetchpriority\', \'high\');',
    '              if (first.imgSrcset) {',
    '                preload.setAttribute(\'imagesrcset\', first.imgSrcset);',
    '                preload.setAttribute(\'imagesizes\', imageSizes);',
    '              }',
    '              document.head.appendChild(preload);',
  ].join('\n');
  const noDuplicatePreloadBlock = [
    '              var existing = document.getElementById(id);',
    '              var existingHref = existing ? new URL(existing.href, location.href).href : "";',
    '              var expectedHref = new URL(first.img, location.href).href;',
    '              if (!existing || existingHref !== expectedHref) {',
    '                if (existing) existing.remove();',
    '                var preload = document.createElement("link");',
    '                preload.id = id;',
    '                preload.rel = "preload";',
    '                preload.as = "image";',
    '                preload.href = first.img;',
    '                preload.type = "image/webp";',
    '                preload.setAttribute("fetchpriority", "high");',
    '                if (first.imgSrcset) {',
    '                  preload.setAttribute("imagesrcset", first.imgSrcset);',
    '                  preload.setAttribute("imagesizes", imageSizes);',
    '                }',
    '                document.head.appendChild(preload);',
    '              }',
  ].join('\n');
  if (!html.includes(preloadBlock)) throw new Error('perf-exp: existing preload block not found');
  html = html.replace(preloadBlock, noDuplicatePreloadBlock);
  return html;
}

export async function installHtmlVariantRoute(page, variant) {
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== '/' || route.request().method() !== 'GET' || !route.request().isNavigationRequest()) {
      return route.continue();
    }
    const response = await route.fetch();
    const html = await response.text();
    return route.fulfill({ response, body: patchHtmlDocument(html, variant) });
  });
}
