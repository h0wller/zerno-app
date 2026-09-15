/* public/app/core/config.js — Ф3.10b: bootstrap /api/config.
   Растворено из fix-views.js (секция 14). Зависит от window.relink, window.renderVerifyNote,
   window.TG_USERNAME — все публикуются выше в window. */
(function () {
  'use strict';
  fetch(API_BASE + '/api/config')
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      window.TG_USERNAME = cfg.tgUsername || 'and_coffee_bot';
      if (typeof window.relink === 'function') window.relink();
      if (typeof window.renderVerifyNote === 'function') window.renderVerifyNote();
    })
    .catch(function () {});
})();