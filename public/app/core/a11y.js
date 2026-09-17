/* lazy-img: loading=lazy + decoding=async, кроме LCP-картинки первого экрана. */
function applyLazy(img) {
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