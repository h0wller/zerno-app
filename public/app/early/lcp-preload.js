/* PERF-P0 v2: preload LCP-картинки ТОЛЬКО для бренда доставки.
   Кофейная марка — инлайн-SVG в шапке (предзагружать нечего, 404 устранён).
   Доставка: friday-logo.svg уходит в сеть параллельно со шрифтами. */
(function () {
  function detectBrand() {
    try {
      var qs = (location.search.match(/[?&]brand=([^&]+)/) || [])[1];
      if (qs === 'delivery' || qs === 'coffee') return qs;
      var ls = '';
      try { ls = localStorage.getItem('zt_brand') || ''; } catch (e) {}
      if (ls === 'delivery' || ls === 'coffee') return ls;
      return 'coffee';
    } catch (e) { return 'coffee'; }
  }
  if (detectBrand() !== 'delivery') return; /* coffee: LCP = инлайн-SVG/h1, запрос не нужен */
  var link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = '/friday-logo.svg';
  link.setAttribute('fetchpriority', 'high');
  link.onerror = function () { /* офлайн/блок: молча пропускаем, SW отдаст кэш */ };
  document.head.appendChild(link);
})();
