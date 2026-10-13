/* public/app/core/splash.js — Холодный старт и выбор бренда */
(function () {
  var QS = new URLSearchParams(location.search);
  // Товар, вкладка, номер заказа или повтор заказа — это реальные диплинки, которые пропускают сплэш.
  // Параметр ?brand= НЕ пропускает сплэш, чтобы при холодном старте гость всегда выбирал заведение.
  var hasDeeplink = !!(QS.get('item') || QS.get('tab') || QS.get('no') || QS.get('reorder'));
  var isAudit = document.documentElement.classList.contains('is-audit') || QS.get('lighthouse') === '1';

  var done = false;
  try {
    done = sessionStorage.getItem("splashDone") === '1';
  } catch (e) {}

  // Если сессия продолжается (теплый старт) или перешли по диплинку на товар — скрываем сплэш
  if (done || hasDeeplink || isAudit) {
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    var s = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (s) s.remove();
    return;
  }

  // Холодный старт: активируем режим сплэша
  document.documentElement.classList.add('need-splash');
  document.documentElement.classList.remove('no-splash');

  function finish(choice) {
    try { sessionStorage.setItem("splashDone", "1"); } catch (e) {}
    try { localStorage.setItem("zt_brand", choice); } catch (e) {}
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    var el = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (el) el.remove();
    if (typeof window.applyBrand === 'function') {
      window.applyBrand(choice);
    } else if (typeof window.switchBrand === 'function') {
      window.switchBrand(choice);
    } else {
      location.search = '?brand=' + choice;
    }
  }

  function initSplash() {
    var ss = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (!ss) {
      ss = document.createElement('div');
      ss.id = 'brandSplashStatic';
      ss.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;z-index:999999;background:#F6F1EB;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center;';
      ss.innerHTML =
        '<div style="max-width:320px;width:100%;display:flex;flex-direction:column;gap:16px;">' +
          '<h2 style="font-size:24px;font-weight:800;color:#1E2833;margin:0 0 4px;">Куда отправимся?</h2>' +
          '<p style="font-size:14px;color:#6C7A89;margin:0 0 12px;">Выберите заведение</p>' +
          '<button type="button" data-go="delivery" style="width:100%;padding:16px 20px;border-radius:16px;border:2px solid #E2D7CC;background:#FFFFFF;color:#1E2833;font-size:17px;font-weight:700;display:flex;align-items:center;gap:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.06);">' +
            '<span style="font-size:28px;">🍕</span>' +
            '<div style="text-align:left;"><div style="font-size:17px;font-weight:800;color:#D84315;">«Пятница»</div><div style="font-size:12px;color:#8C7B6E;font-weight:500;">доставка пиццы и роллов</div></div>' +
          '</button>' +
          '<button type="button" data-go="coffee" style="width:100%;padding:16px 20px;border-radius:16px;border:2px solid #D0DFEE;background:#FFFFFF;color:#1E2833;font-size:17px;font-weight:700;display:flex;align-items:center;gap:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.06);">' +
            '<span style="font-size:28px;">🌊</span>' +
            '<div style="text-align:left;"><div style="font-size:17px;font-weight:800;color:#123A6B;">«…и кофе»</div><div style="font-size:12px;color:#6C8299;font-weight:500;">кофейня у моря</div></div>' +
          '</button>' +
        '</div>';
      document.body.appendChild(ss);
    }

    ss.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      e.preventDefault();
      finish(b.dataset.go);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplash);
  } else {
    initSplash();
  }
})();
