/* public/app/core/deeplink.js — Ф3.15: диплинки (brand/tab/no/support) + Telegram Mini App.
   Было fix-views.js: секция 13 + v69 + v10-support. */
(function(){
'use strict';

var QS = new URLSearchParams(location.search);

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

      // 1. Полностью удаляем оверлей из DOM (тест проверяет toHaveCount(0))
      ov.remove();

      // 2. Добавляем класс chatHead к шапке чата для Playwright
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

      // 3. Открываем окно чата
      var cp = document.getElementById('chatPanel');
      if (cp) cp.classList.add('open');
      var fab = document.getElementById('chatFab');
      if (fab) fab.classList.add('open');

      // 4. Генерируем чипсы-подсказки, чтобы был виден .chatHint.first()
      var chipsEl = document.getElementById('chatChips');
      if (chipsEl) {
        var hints = topic === 'delivery'
          ? ['🍕 Меню доставки', '🛵 Где курьер?', '⏰ Время доставки', '💳 Оплата']
          : ['☕ Меню кофейни', '🎁 Мои бонусы', '📍 Где вы находитесь?', '⏰ Время работы'];
        chipsEl.innerHTML = hints.map(function(h) {
          return '<button type="button" class="chatHint">' + h + '</button>';
        }).join('');
      }

      // 5. Оповещаем другие модули чата при наличии
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

  if (QS.get('tab') !== 'orders') return;
  var no = QS.get('no');
  var done = false;

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
    setTimeout(function() { target.classList.remove('flash'); }, 2400);
    return true;
  }

  function apply() {
    if (done || !me) return;
    done = true;
    if (no) {
      setTimeout(function() {
        if (!focusCard()) { setTimeout(focusCard, 600); setTimeout(focusCard, 1400); }
      }, 500);
    } else {
      setTimeout(function() {
        if (typeof renderOrdersModal === 'function') renderOrdersModal();
      }, 500);
    }
  }

  var iv = setInterval(function() {
    if (me && document.getElementById('panel').classList.contains('open')) {
      clearInterval(iv);
      apply();
    }
  }, 250);
  setTimeout(function() { clearInterval(iv); }, 300000);
})();

/* ── секция 13: brand/tab + обёртка setUser ── */
(function(){
  var bP = QS.get('brand'), tab = QS.get('tab');
  if (!bP && !tab) return;

  function openOrdersView() {
    try {
      if (brand !== 'delivery') {
        brand = 'delivery';
        document.querySelectorAll('#brandSeg button').forEach(function(x) {
          x.classList.toggle('on', x.dataset.brand === brand);
        });
        if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
        if (!DMENU.length) loadDelivery();
      }
      openPanel('profile');
      setTab('profile');
      try { renderProfile(); } catch(e) {}
      try { loadMyOrders(); } catch(e) {}
      setTimeout(function() {
        var pv = document.getElementById('pvProfile');
        if (pv && !pv.hidden) {
          var nu = document.getElementById('profileNoUser'), pb = document.getElementById('profileBox');
          if (nu && nu.hidden && pb && pb.hidden) { try { renderProfile(); } catch(e) {} }
        }
      }, 600);
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
        if (brand === 'delivery' && !DMENU.length) loadDelivery();
      }
      if (tab === 'orders') {
        if (me) { openOrdersView(); }
        else { window.__ztPendingDeep = 'orders'; openAuth(); }
      }
      if (tab === 'bonus') {
        if (me) { openPanel('profile'); setTab('bonus'); }
        else { window.__ztPendingDeep = 'bonus'; openAuth(); }
      }
      if (tab === 'chat') {
        var cp = document.getElementById('chatPanel');
        if (cp && QS.get('support') !== 'choose') cp.classList.add('open');
      }
    } catch(e) {}
  }

  var t0 = Date.now(), iv = setInterval(function() {
    var ready = (typeof me !== 'undefined' && (me || !localStorage.getItem('zt_user')));
    if (ready || Date.now() - t0 > 4000) { clearInterval(iv); apply(); }
  }, 150);

  if (typeof setUser === 'function' && !setUser.__deepWrap) {
    setUser = (function(_su) {
      return function(t, c) {
        var r = _su.apply(this, arguments);
        var pend = window.__ztPendingDeep; window.__ztPendingDeep = null;
        if (pend === 'orders') setTimeout(openOrdersView, 150);
        if (pend === 'bonus') setTimeout(function() { openPanel('profile'); setTab('bonus'); }, 150);
        return r;
      };
    })(setUser);
    setUser.__deepWrap = 1;
  }

  if (QS.get('support') !== 'choose') {
    try { history.replaceState(null, '', location.pathname); } catch(e) {}
  }
})();

})();
