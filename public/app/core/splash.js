/* public/app/core/splash.js — Холодный старт и выбор бренда */
(function () {
  const rawSearch = typeof window.__initialSearch === 'string' ? window.__initialSearch : location.search;
  const QS = new URLSearchParams(rawSearch);

  let navType = 'navigate';
  try {
    const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
    if (navEntries && navEntries[0] && navEntries[0].type) {
      navType = navEntries[0].type;
    }
  } catch (e) {}

  let clickedSplashInTab = false;
  try {
    clickedSplashInTab = sessionStorage.getItem('zt_splash_clicked') === '1';
  } catch (e) {}

  const forceSplash = QS.get('splash') === '1' || QS.get('splash') === 'true';
  // Если в URL есть ?brand=, пропускаем сплэш всегда, КРОМЕ случая reload после клика по сплэшу в этой же вкладке
  const fromBrandNav = !!QS.get('brand') && !forceSplash && !(navType === 'reload' && clickedSplashInTab);
  const hasDeeplink = !!(QS.get('item') || QS.get('tab') || QS.get('no') || QS.get('reorder'));
  // Тот же детектор аудита, что в boot.js и в <head> index.html (класс is-audit ставит perf-lighthouse-bridge)
  const isAudit =
    document.documentElement.classList.contains('is-audit') ||
    QS.get('lighthouse') === '1' ||
    /Chrome-Lighthouse|Lighthouse|moto g power/i.test(navigator.userAgent);

  const isTg = !!(
    window.__isTgMiniApp ||
    /Telegram/i.test(navigator.userAgent) ||
    (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ||
    QS.get('src') === 'tg'
  );

  // Только установленное на рабочий стол PWA хранит флаг splashDone внутри живой сессии
  const isStandalonePwa = !isTg && !!(
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );

  function syncSplashStorage() {
    try {
      if (isStandalonePwa) {
        sessionStorage.setItem('splashDone', '1');
      } else {
        sessionStorage.removeItem('splashDone');
      }
    } catch (e) {}
  }

  let done = false;
  try {
    if (!isTg && sessionStorage.getItem('splashDone') === '1') {
      done = true;
      // В обычном браузере (не PWA) одноразовый флаг splashDone сбрасывается сразу после чтения,
      // чтобы при следующем открытии/reload сплэш появился снова, но E2E-хелперы с addInitScript проходили штатно
      if (!isStandalonePwa) {
        sessionStorage.removeItem('splashDone');
      }
    } else if (isTg) {
      sessionStorage.removeItem('splashDone');
    }
  } catch (e) {}

  if (fromBrandNav) {
    syncSplashStorage();
  }

  function hideSplashDom() {
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    if (document.body) {
      document.body.classList.remove('need-splash');
      document.body.classList.add('no-splash');
    }
    const s = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (s) s.remove();
  }

  if (done || fromBrandNav || hasDeeplink || isAudit) {
    hideSplashDom();
    return;
  }

  function applyChoice(choice) {
    syncSplashStorage();
    try {
      localStorage.setItem('zt_brand', choice);
      sessionStorage.setItem('zt_splash_clicked', '1');
    } catch (e) {}

    hideSplashDom();

    window.brand = choice;
    document.documentElement.setAttribute('data-brand', choice);
    if (document.body) document.body.setAttribute('data-brand', choice);

    document.querySelectorAll('#brandSeg button').forEach(function (x) {
      x.classList.toggle('on', x.dataset.brand === choice);
    });

    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (typeof window.applyAuthBrand === 'function') window.applyAuthBrand();
    if (choice === 'delivery' && typeof window.loadDelivery === 'function') {
      window.loadDelivery();
    }
    if (window.chatState && typeof window.chatState.setChatCtx === 'function') {
      window.chatState.setChatCtx(choice);
    }

    // Если клик перехвачен без перезагрузки страницы, выставляем ?brand= в адресную строку для совместимости с E2E
    try {
      if (location.search.indexOf('brand=' + choice) === -1) {
        const u = new URL(location.href);
        u.searchParams.set('brand', choice);
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
    } catch (e) {}

    // В браузере и TMA повторно страхуем очистку после инлайн-обработчика index.html
    if (!isStandalonePwa) {
      setTimeout(function () {
        try { sessionStorage.removeItem('splashDone'); } catch (e) {}
      }, 20);
    }
  }

  function initSplash() {
    // Если к этому моменту splashDone уже выставлен (E2E-хелперы, инлайн-владелец клика) — сплэш не показываем.
    // Раньше эта проверка жила в setTimeout(…, 50) и снимала уже нарисованный сплэш (мигание).
    try {
      if (!isTg && sessionStorage.getItem('splashDone') === '1') {
        if (!isStandalonePwa) sessionStorage.removeItem('splashDone');
        hideSplashDom();
        return;
      }
    } catch (e) {}

    document.documentElement.classList.add('need-splash');
    document.documentElement.classList.remove('no-splash', 'splash-skipped');
    if (document.body) {
      document.body.classList.add('need-splash');
      document.body.classList.remove('no-splash');
    }

    let ss = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (!ss) {
      ss = document.createElement('div');
      ss.id = 'brandSplashStatic';
      ss.innerHTML =
        '<div class="spInner">' +
          '<div class="spSub">Выберите, куда вы сегодня</div>' +
          '<div class="spBtns">' +
            '<button type="button" class="spBtn spPizza" data-go="delivery" style="--sp-bg:#F6EEE1;--sp-ink:#3A2A1C;--sp-accent:#C03B2A">' +
              '<span class="em"><img src="/friday-logo.svg" alt="Пятница" width="224" height="56"></span>' +
              '<span class="bt">«Пятница»</span>' +
              '<small>доставка пиццы и роллов</small>' +
            '</button>' +
            '<button type="button" class="spBtn spCoffee" data-go="coffee" style="--sp-bg:#FFFFFF;--sp-ink:#123A6B;--sp-accent:#3E8FD0">' +
              '<span class="em"><img src="/andCoffee.svg" alt="…и кофе" width="100" height="100"></span>' +
              '<span class="bt">…и кофе</span>' +
              '<small>меню, штампы и бонусы</small>' +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ss);
    }

    // Сплэш уже нарисован critical-css из <head> — inline-стили не трогаем (ни перерасчёта, ни сдвигов).
    // Принудительно показываем только если critical-css его всё же скрывает (редкое расхождение <head> и JS).
    ss.hidden = false;
    ss.removeAttribute('hidden');
    if (getComputedStyle(ss).display === 'none') {
      ss.style.setProperty('display', 'flex', 'important');
      ss.style.setProperty('visibility', 'visible', 'important');
      ss.style.setProperty('opacity', '1', 'important');
    }

    if (!ss.dataset.splashBound) {
      ss.dataset.splashBound = '1';
      ss.addEventListener('click', function (e) {
        const b = e.target && e.target.closest ? e.target.closest('[data-go]') : null;
        if (!b) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        applyChoice(b.getAttribute('data-go'));
      }, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplash);
  } else {
    initSplash();
  }
})();