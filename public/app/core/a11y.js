/* lazy-img: loading=lazy + decoding=async, кроме LCP-картинки первого экрана. */
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
  // Фикс CLS для ленивых картинок без размеров
  if (!img.getAttribute('width') && !img.getAttribute('height') && !img.style.aspectRatio) {
    img.style.aspectRatio = '1 / 1'; // Задаем квадратный дефолтный аспект-рецио, чтобы не было прыжков 0x0
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