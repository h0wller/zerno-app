/* lazy-img: loading=lazy + decoding=async, кроме LCP-картинки первого экрана. */
function applyLazy(img) {
  if (img.dataset.lazyDone) return;
  img.dataset.lazyDone = '1';
  // Не трогаем брендовые логотипы и карточки меню (у них свои пропорции в CSS)
  if (img.closest('.topbar') || img.classList.contains('brandLogo') || img.closest('.media') || img.closest('.card')) {
    return;
  }
  var g = img.closest && img.closest('#grid, #deliveryGrid');
  if (g && g.querySelector('img') === img) {
    img.loading = 'eager';
    img.decoding = 'async';
    try { img.fetchPriority = 'high'; } catch (e) {}
    return;
  }
  if (img.loading !== 'lazy') {
    img.loading = 'lazy';
    img.decoding = 'async';
  }
  if (!img.getAttribute('width') && !img.getAttribute('height') && !img.style.aspectRatio) {
    img.style.aspectRatio = '1 / 1';
    img.style.width = '100%';
    img.style.height = 'auto';
  }
}
function lazify(root) {
  if (root.nodeType === 1 && root.tagName === 'IMG') applyLazy(root);
  (root || document).querySelectorAll('img').forEach(applyLazy);
}
lazify(document);
new MutationObserver(function (ms) {
  ms.forEach(function (m) {
    m.addedNodes && m.addedNodes.forEach(function (n) {
      if (n.nodeType === 1) lazify(n);
    });
  });
}).observe(document.body, { childList: true, subtree: true });