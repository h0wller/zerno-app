/* lazy-img: loading=lazy + decoding=async, кроме LCP-картинки первого экрана.
   F5.68: детерминированный lazify без фонового MutationObserver на document.body. */
function applyLazy(img) {
  if (!img || img.dataset.lazyDone) return;
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
  var target = root || document;
  if (target.nodeType === 1 && target.tagName === 'IMG') applyLazy(target);
  target.querySelectorAll('img').forEach(applyLazy);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { lazify(document); }, { once: true });
} else {
  lazify(document);
}

window.lazify = lazify;