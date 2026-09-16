/* lazy-img: loading=lazy + decoding=async, включая динамически добавленные.
   Ф6.1: первая картинка в #grid/#deliveryGrid — LCP-элемент — грузится сразу. */
function applyLazy(img) {
  if (img.dataset && img.dataset.lcp) return;
  if (img.loading !== 'lazy') {
    img.loading = 'lazy';
    img.decoding = 'async';
  }
}
function applyLcp(img) {
  img.loading = 'eager';
  img.decoding = 'async';
  try { img.fetchPriority = 'high'; } catch (e) {}
}
function isLcpImg(img) {
  var grid = img.closest && img.closest('#grid, #deliveryGrid');
  if (!grid) return false;
  return grid.querySelector('img') === img;
}
function lazify(root) {
  if (root && root.nodeType === 1 && root.tagName === 'IMG') {
    if (isLcpImg(root)) applyLcp(root); else applyLazy(root);
    return;
  }
  (root || document).querySelectorAll('img').forEach(function (img) {
    if (isLcpImg(img)) applyLcp(img); else applyLazy(img);
  });
}
lazify(document);
new MutationObserver(function (ms) {
  ms.forEach(function (m) {
    m.addedNodes && m.addedNodes.forEach(function (n) {
      if (n.nodeType === 1) lazify(n);
    });
  });
}).observe(document.body, { childList: true, subtree: true });