  /* lazy-img: loading=lazy + decoding=async, включая динамически добавленные */
  function applyLazy(img) {
    if (img.loading !== 'lazy') {              // ← было if (!img.loading), стало явное сравнение
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