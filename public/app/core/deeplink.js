/* public/app/core/deeplink.js — Ф3.15: диплинки (brand/tab/no/support) + Telegram Mini App. */
import { restoreOrderItems } from './order-reorder.js';
(function(){
'use strict';

var QS = new URLSearchParams(location.search);

function buildAppReturnPath(brandOverride) {
  var pathname = window.__initialPathname || location.pathname || '/';
  var search = typeof window.__initialSearch === 'string' ? window.__initialSearch : location.search;
  var hash = typeof window.__initialHash === 'string' ? window.__initialHash : location.hash;
  var target = new URL(pathname + search + hash, location.origin);

  [
    'auth_token', 'access_token', 'token', 'pollToken', 'ref',
    'tgWebAppData', 'tgWebAppPlatform', 'tgWebAppVersion', 'tgWebAppBotId'
  ].forEach(function (key) {
    target.searchParams.delete(key);
  });

  if (brandOverride === 'coffee' || brandOverride === 'delivery') {
    target.searchParams.set('brand', brandOverride);
  }

  // Older Telegram clients may place signed launch data inside the URL hash.
  if (/tgWebApp(?:Data|Platform|Version|BotId)=/i.test(target.hash)) {
    target.hash = '';
  }

  return target.pathname + target.search + target.hash;
}
window.getAppReturnPath = buildAppReturnPath;


// A one-time Telegram auth token must not remain in browser history/referrers.
if (QS.has('auth_token')) {
  var safeQuery = new URLSearchParams(location.search);
  safeQuery.delete('auth_token');
  var safeSearch = safeQuery.toString();
  try {
    history.replaceState(null, '', location.pathname + (safeSearch ? '?' + safeSearch : '') + location.hash);
  } catch (_) {}
}
if (typeof window.__initialSearch === 'undefined') {
  window.__initialSearch = location.search;
}

/* ── QR с постера: ?ref=qr → запомнить источник и сразу открыть регистрацию (если гость не вошёл) ── */
(function initQrRef() {
  if (QS.get('ref') !== 'qr') return;
  try { localStorage.setItem('zt_src', 'qr'); } catch (_) {}
  var t0 = Date.now();
  var iv = setInterval(function () {
    var loggedIn = false;
    try { loggedIn = !!localStorage.getItem('zt_user'); } catch (_) {}
    if (loggedIn || Date.now() - t0 > 8000) { clearInterval(iv); return; }
    if (typeof window.openAuth === 'function') {
      clearInterval(iv);
      window.openAuth(false);
    }
  }, 300);
})();

  // [tg-web-seamless-auth-v1]
  (function initAuthTokenLogin() {
    var at = QS.get('auth_token');
    if (!at) return;
    var t0 = Date.now(), iv = setInterval(function() {
      if (typeof api === 'function' && typeof window.setUser === 'function') {
        clearInterval(iv);
        api('/me', { headers: { Authorization: 'Bearer ' + at } })
          .then(function(res) {
            if (res && res.customer) {
              window.setUser(at, res.customer);
              if (typeof renderAll === 'function') renderAll();
              if (typeof toast === 'function') toast('Вход выполнен! С возвращением, ' + res.customer.name, '👋');
            }
          })
          .catch(function() {});
      }
      if (Date.now() - t0 > 4000) clearInterval(iv);
    }, 150);
  })();

/* ── v10-support: диплинк выбора темы поддержки (?support=choose) ── */
/* Support topic selection and #supportChooseOverlay are owned by chat-core.js. */

/* ── v69: диплинк заказов: «мой заказ» → фокус, «мои заказы» → история ── */
(function(){
  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var css = document.createElement('style');
  css.textContent = '.myOrderCard.flash{outline:3px solid rgba(31,78,140,.55);outline-offset:2px;animation:oflash 2.4s}' +
  '@keyframes oflash{0%{background:#EAF1F9}100%{background:#fff}}' +
  '@media (prefers-reduced-motion:reduce){.myOrderCard.flash{animation:none}}';
  document.head.appendChild(css);

  var bP = QS.get('brand');
  var tab = QS.get('tab');
  var no = QS.get('no');

  function ensureProfileReady() {
    var pv = document.getElementById('pvProfile');
    if (pv && !pv.hidden) {
      var nu = document.getElementById('profileNoUser');
      var pb = document.getElementById('profileBox');
      if (nu && nu.hidden && pb && pb.hidden && typeof renderProfile === 'function') {
        renderProfile();
      }
    }
  }

  function focusCard() {
    var cards = document.querySelectorAll('#myOrders .myOrderCard');
    if (!cards.length) return false;
    var target = null;
    if (no) {
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].textContent.indexOf('#' + no) > -1) { target = cards[i]; break; }
      }
    }
    if (!target) target = cards[0];
    try {
      target.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    } catch(e) {}
    target.classList.add('flash');
    return true;
  }

  function openOrdersView() {
    try {
      openPanel('profile');
      setTab('profile');
      if (typeof renderProfile === 'function') renderProfile();
      setTimeout(ensureProfileReady, 600);
    } catch(e) {}
  }

  function openReviewView(_forReview) {
    try {
      openPanel('profile');
      setTab('profile');
      if (typeof renderProfile === 'function') renderProfile();
      setTimeout(function() {
        ensureProfileReady();
        var btn = document.getElementById('reviewBtn');
        if (btn) {
          btn.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'center'
          });
          btn.classList.add('glow');
        }
      }, 500);
    } catch(e) {}
  }

  function apply() {
    try {
      if (bP && bP !== brand) {
        brand = bP;
        document.querySelectorAll('#brandSeg button').forEach(function(x) {
          x.classList.toggle('on', x.dataset.brand === brand);
        });
        if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
        if (brand === 'delivery' && (!window.DMENU || !window.DMENU.length) && typeof loadDelivery === 'function') loadDelivery();
      }

      if (tab === 'orders') {
        if (window.me) { 
          openOrdersView(); 
          var t0 = Date.now();
          var ivFocus = setInterval(function() {
            if (focusCard() || Date.now() - t0 > 4000) clearInterval(ivFocus);
          }, 200);
        }
        else { window.__ztPendingDeep = 'orders'; openAuth(); }
      }
      if (tab === 'profile' || tab === 'review') {
        if (window.me) { openReviewView(tab === 'review'); }
        else { window.__ztPendingDeep = tab; openAuth(); }
      }
      if (tab === 'bonus') {
        if (window.me) {
          openPanel('profile');
          setTab('bonus');
          setTimeout(function () {
            if (typeof openQRFull === 'function') {
              try { openQRFull(); } catch (e) {}
            }
          }, 500);
        }
        else { window.__ztPendingDeep = 'bonus'; openAuth(); }
      }
      
      if (tab === 'staff_chat') {
        const targetKey = QS.get('key');
        setTimeout(() => {
          if (targetKey && typeof window.openStaffChatThread === 'function') {
            window.openStaffChatThread(targetKey);
          } else if (typeof window.openStaffChat === 'function') {
            window.openStaffChat();
          }
        }, 300);
      }
  
      if (tab === 'chat') {
        var cp = document.getElementById('chatPanel');
        if (cp && QS.get('support') !== 'choose') cp.classList.add('open');
        if (QS.get('ctx')) {
          setTimeout(function () {
            if (typeof window.reloadChatThread === 'function') window.reloadChatThread();
            if (typeof window.setBotName === 'function') window.setBotName();
          }, 350);
        }
      }
    } catch(e) {}
  }

  var t0 = Date.now(), iv = setInterval(function() {
    var ready = (typeof me !== 'undefined' && (me || !localStorage.getItem('zt_user')));
    if (ready || Date.now() - t0 > 4000) { clearInterval(iv); apply(); }
  }, 150);

  if (typeof window.setUser === 'function' && !window.setUser.__deepWrap) {
    window.setUser = (function(_su) {
      return function (_t, _c) {
        var r = _su.apply(this, arguments);
        var pend = window.__ztPendingDeep; window.__ztPendingDeep = null;
        if (pend === 'orders') setTimeout(openOrdersView, 150);
        if (pend === 'bonus') setTimeout(function() { openPanel('profile'); setTab('bonus'); }, 150);
        if (pend === 'profile' || pend === 'review') setTimeout(function() { openReviewView(pend === 'review'); }, 150);
        return r;
      };
    })(window.setUser);
    window.setUser.__deepWrap = 1;
  }

  // [tg-mini-app-reorder]
  (function () {
    var rid = QS.get('reorder');
    if (!rid) return;
    var tries = 0;
    var ivReorder = setInterval(function () {
      tries++;
      if (window.me && typeof api === 'function') {
        clearInterval(ivReorder);
        api('/orders/mine').then(async function (data) {
          var order = (data.orders || []).find(function (x) { return x.id === rid; });
          if (!order) return;
          if ((!Array.isArray(window.DMENU) || !window.DMENU.length) &&
              (order.items || []).some(function (item) { return item.opt && !Number.isInteger(item.oi); }) &&
              typeof window.loadDelivery === 'function') {
            await window.loadDelivery();
          }
          var restored = restoreOrderItems(order.items, window.DMENU);
          if (restored.some(function (item) { return item.opt && item.oi < 0; })) {
            if (typeof toast === 'function') toast('Не удалось восстановить вариант одной из позиций. Проверьте меню и повторите заказ.', '⚠️');
            return;
          }
          if (typeof window.replaceCartItems !== 'function') return;
          window.replaceCartItems(restored);
          if (typeof window.syncAddButtons === 'function') window.syncAddButtons();
          var cp = document.getElementById('cartPanel');
          if (cp) cp.classList.add('open');
          if (typeof window.syncOverlay === 'function') window.syncOverlay();
          if (typeof toast === 'function') toast('Заказ восстановлен в корзине', '🛒');
        }).catch(function () {});
      }
      if (tries > 40) clearInterval(ivReorder);
    }, 250);
  })();

  if (QS.get('support') !== 'choose') {
    try { history.replaceState(null, '', location.pathname); } catch(e) {}
  }
})();

})();
