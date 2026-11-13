/* public/app/core/config.js — Ф3.10b: bootstrap /api/config.
   Растворено из fix-views.js (секция 14). Зависит от window.relink, window.renderVerifyNote,
   window.TG_USERNAME — все публикуются выше в window. */
(function () {
  'use strict';
  window.SMS_AUTH_ENABLED = false;

  function loadConfig() {
    fetch(API_BASE + '/api/config')
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        window.TG_USERNAME = cfg.tgUsername || 'and_coffee_bot';
        window.SMS_AUTH_ENABLED = cfg.smsAuthEnabled === true;
        window.dispatchEvent(new Event('app:config-loaded'));
        if (typeof window.relink === 'function') window.relink();
        if (typeof window.renderVerifyNote === 'function') window.renderVerifyNote();
      })
      .catch(function () {});
  }

  function scheduleConfig() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(loadConfig, { timeout: 2500 });
    } else {
      setTimeout(loadConfig, 800);
    }
  }
  if (document.readyState === 'complete') scheduleConfig();
  else window.addEventListener('load', scheduleConfig, { once: true });
})();