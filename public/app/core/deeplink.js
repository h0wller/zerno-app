/* public/app/core/deeplink.js — Ф3.15: диплинки (brand/tab/no/support) + Telegram Mini App.
   Было fix-views.js: секция 13 + v69 + v10-support. */
(function(){
'use strict';

var QS = new URLSearchParams(location.search);

  // [tg-web-seamless-auth-v1]
  (function initAuthTokenLogin() {
    var at = QS.get('auth_token');
    if (!at) return;
    var t0 = Date.now(), iv = setInterval(function() {
      if (typeof api === 'function' && typeof setUser === 'function') {
        clearInterval(iv);
        api('/me', { headers: { Authorization: 'Bearer ' + at } })
          .then(function(res) {
            if (res && res.customer) {
              setUser(at, res.customer);
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
(function initSupportChoose() {
  if (QS.get('support') !== 'choose') return;

  function showSupportOverlay() {
    if (document.getElementById('supportChooseOverlay')) return;

    var ov = document.createElement('div');
    ov.id = 'supportChooseOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(16,20,24,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';

    ov.innerHTML = 
      '<div style="background:#fff;border-radius:20px;padding:24px;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.3);position:relative">' +
        '<h3 style="margin:0 0 8px;font-size:18px;font-family:\'Prata\',serif;color:#123A6B">Служба заботы</h3>' +
        '<p style="color:#586470;font-size:13px;margin:0 0 18px">Выберите тему обращения в поддержку</p>' +
        '<div style="display:grid;gap:10px">' +
          '<button type="button" class="btn fire" data-support-topic="delivery" style="width:100%;padding:14px;font-size:14px;border-radius:12px;background:#C03B2A;color:#fff;border:none;font-weight:700;cursor:pointer">' +
            '🍕 Доставка («Пятница»)' +
          '</button>' +
          '<button type="button" class="btn ghost" data-support-topic="coffee" style="width:100%;padding:14px;font-size:14px;border-radius:12px;background:#F3F8FC;color:#123A6B;border:1.5px solid #D8DFE4;font-weight:700;cursor:pointer">' +
            '🌊 Кофейня («…и кофе»)' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);

    ov.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-support-topic]');
      if (!btn) return;
      var topic = btn.dataset.supportTopic;

      ov.remove();

      var chatHead = document.querySelector('#chatPanel .chat-h, #chatPanel .chatHead');
      if (chatHead) {
        chatHead.classList.add('chatHead');
        var b = chatHead.querySelector('b');
        if (b) {
          b.textContent = topic === 'delivery' 
            ? 'Ника · доставка («Пятница»)' 
            : 'Ника · кофейня («…и кофе»)';
        }
      }

      var cp = document.getElementById('chatPanel');
      if (cp) cp.classList.add('open');
      var fab = document.getElementById('chatFab');
      if (fab) fab.classList.add('open');

      var chipsEl = document.getElementById('chatChips');
      if (chipsEl) {
        var hints = topic === 'delivery'
          ? ['🍕 Меню доставки', '🛵 Где курьер?', '⏰ Время доставки', '💳 Оплата']
          : ['☕ Меню кофейни', '🎁 Мои бонусы', '📍 Где вы находитесь?', '⏰ Время работы'];
        chipsEl.innerHTML = hints.map(function(h) {
          return '<button type="button" class="chatHint">' + h + '</button>';
        }).join('');
      }

      try {
        if (typeof window.setChatContext === 'function') window.setChatContext(topic);
        if (typeof window.switchChatTopic === 'function') window.switchChatTopic(topic);
      } catch(_) {}

      try {
        history.replaceState(null, '', location.pathname);
      } catch(_) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showSupportOverlay);
  } else {
    showSupportOverlay();
  }
})();

/* ── v69: диплинк заказов: «мой заказ» → фокус, «мои заказы» → история ── */
(function(){
  var css = document.createElement('style');
  css.textContent = '.myOrderCard.flash{outline:3px solid rgba(31,78,140,.55);outline-offset:2px;animation:oflash 2.4s}' +
  '@keyframes oflash{0%{background:#EAF1F9}100%{background:#fff}}';
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
    try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(e) {}
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
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          if (typeof window.openStaffChat === 'function') {
            window.openStaffChat();
            if (targetKey && typeof window.openScDialog === 'function') {
              window.scKey = targetKey;
              setTimeout(window.openScDialog, 200);
            }
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

  if (typeof setUser === 'function' && !setUser.__deepWrap) {
    setUser = (function(_su) {
      return function (_t, _c) {
        var r = _su.apply(this, arguments);
        var pend = window.__ztPendingDeep; window.__ztPendingDeep = null;
        if (pend === 'orders') setTimeout(openOrdersView, 150);
        if (pend === 'bonus') setTimeout(function() { openPanel('profile'); setTab('bonus'); }, 150);
        if (pend === 'profile' || pend === 'review') setTimeout(function() { openReviewView(pend === 'review'); }, 150);
        return r;
      };
    })(setUser);
    setUser.__deepWrap = 1;
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
        api('/orders/mine').then(function (data) {
          var order = (data.orders || []).find(function (x) { return x.id === rid; });
          if (!order) return;
          var restored = (order.items || []).map(function (i) {
            return {
              key: String(i.id) + '_' + (i.opt || '0'),
              id: i.id,
              oi: -1,
              name: i.name,
              opt: i.opt || null,
              price: Number(i.price) || 0,
              sz: Number(i.sz) || 0,
              qty: Number(i.qty) || 1,
            };
          });
          window.cart = restored;
          try { localStorage.setItem('zt_cart', JSON.stringify(restored)); } catch (e) {}
          if (typeof window.updateCartFab === 'function') window.updateCartFab();
          if (typeof window.renderCart === 'function') window.renderCart();
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
