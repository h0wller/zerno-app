/* public/app/core/overlay.js — Ф3.17: единый контроллер оверлея + тап по фону + сброс.
Было fix-views.js: setInterval (овлей над шторкой), v66, v67. */
(function(){
'use strict';


/* оверлей: поднимать над шторкой, когда открыта модалка; убирать залипший show */
setInterval(function(){
  var ov=document.getElementById('overlay');if(!ov)return;
  var modalOpen=!!document.querySelector('.modal.show');
  var panelOpen=document.getElementById('panel').classList.contains('open');
  if(ov.classList.contains('show')&&!modalOpen&&!panelOpen)ov.classList.remove('show');
  ov.classList.toggle('ov-high',modalOpen);
},400);
/* ══ v66: ЕДИНЫЙ контроллер оверлея (модалка 340 / корзина 120 / шторка 320) ══ */
(function(){
var css=document.createElement('style');
css.textContent=
'.modal{z-index:340!important}'+
'#settingsModal,#ordersModal,#redeemPick{z-index:345!important}'+
'#panel.open{z-index:320!important}'+
'.cartPanel{z-index:120!important}';
document.head.appendChild(css);
var histPushed66=false;
function state(){
var modal=document.querySelector('.modal.show');
var cart=document.getElementById('cartPanel');
var panel=document.getElementById('panel');
return {modal:modal,
cartOpen:!!(cart&&cart.classList.contains('open')),
panelOpen:!!(panel&&panel.classList.contains('open'))};
}
function apply(){
var ov=document.getElementById('overlay');if(!ov)return;
var s=state();
var on=!!s.modal||s.cartOpen||s.panelOpen;
ov.classList.toggle('show',on);
ov.style.pointerEvents=on?'auto':'none';
ov.style.zIndex=s.modal?330:(s.cartOpen?110:310);
if(on&&!histPushed66){histPushed66=true;try{history.pushState({zerno:1},'');}catch(e){}}
else if(!on&&histPushed66){histPushed66=false;try{history.back();}catch(e){}}
}
window.syncOverlay=apply;
var ov=document.getElementById('overlay');
if(ov){var oldClick=ov.onclick;
ov.onclick=function(e){
var s=state();
if(s.cartOpen&&!s.modal&&!s.panelOpen)document.getElementById('cartPanel').classList.remove('open');
if(typeof oldClick==='function')oldClick.call(this,e);
apply();
};}
new MutationObserver(apply).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
apply();
})();
/* ══ v67: тап по фону закрывает только верхнюю модалку; сброс только в шестерёнке ══ */
(function(){
var ov=document.getElementById('overlay');
if(ov){
var prev=ov.onclick;
var CLOSE={emModal:'closeEditor',authModal:'closeAuth',pinModal:'closePin',setPinModal:'closeSetPin',qrModal:'closeQRFull',promoModal:'closePromo',dashModal:'closeDash',staffChatModal:'closeStaffChat'};
ov.onclick=function(e){
var m=document.querySelector('.modal.show');
if(m){
if(m.id==='settingsModal'){m.classList.remove('show');}
else{var fn=CLOSE[m.id];if(typeof window[fn]==='function')window[fn]();else m.classList.remove('show');}
if(typeof window.syncOverlay==='function')window.syncOverlay();
return;
}
if(typeof prev==='function')return prev.call(this,e);
};
}
var rb=document.getElementById('resetBtn');
if(rb){
rb.style.display='none';
rb.onclick=function(){
if(!confirm('Выйти из профиля и очистить кэш на этом устройстве?\nШтаммы, заказы и подарки останутся на сервере.'))return;
localStorage.clear();location.reload();
};
}
var rg=document.getElementById('resetGo2');
if(rg){
var row=rg.closest('.set-row');
if(row){var sp=row.querySelector('span');if(sp)sp.textContent='🚪 Выйти и очистить данные этого устройства';}
}
})();
})();

// [tg-ux-controller-final-v1]
(function initTgNativeUx() {
  if (window.__tgUxActive) return;
  window.__tgUxActive = true;

  function tg() {
    return (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  }

  function isTg() {
    var app = tg();
    return !!(window.__tgTestMode ||
      window.__isTgMiniApp ||
      window.__tgInitData ||
      (app && app.initData) ||
      (app && app.initDataUnsafe && (app.initDataUnsafe.query_id || app.initDataUnsafe.user))
    );
  }

  try {
    var appInit = tg();
    if (appInit) {
      if (typeof appInit.ready === 'function') appInit.ready();
      if (typeof appInit.expand === 'function') appInit.expand();
      document.documentElement.classList.add('is-tg-app');
    }
  } catch (e) {}

  function haptic(style) {
    if (window.__tgEvents && Array.isArray(window.__tgEvents.hapticCalls)) {
      window.__tgEvents.hapticCalls.push(style || 'light');
    }
    var app = tg();
    if (!app || !app.HapticFeedback) return;
    try {
      if (style === 'success' || style === 'error' || style === 'warning') {
        app.HapticFeedback.notificationOccurred(style);
      } else {
        app.HapticFeedback.impactOccurred(style || 'light');
      }
    } catch (e) {}
  }

  function state() {
    var modal = document.querySelector('.modal.show, [id$="Modal"].show, .modal-wrap.show, .popup.show, [class*="modal"].show');
    var cart = document.getElementById('cartPanel');
    var panel = document.getElementById('panel');
    return {
      modal: modal,
      cartOpen: !!(cart && cart.classList.contains('open')),
      panelOpen: !!(panel && panel.classList.contains('open'))
    };
  }

  function closeTop() {
    var s = state();
    if (s.modal) {
      var CLOSE = {
        emModal: 'closeEditor',
        authModal: 'closeAuth',
        pinModal: 'closePin',
        setPinModal: 'closeSetPin',
        qrModal: 'closeQRFull',
        promoModal: 'closePromo',
        dashModal: 'closeDash',
        staffChatModal: 'closeStaffChat'
      };
      var fn = CLOSE[s.modal.id];
      if (fn && typeof window[fn] === 'function') {
        window[fn]();
      } else {
        s.modal.classList.remove('show');
      }
    } else if (s.cartOpen) {
      var c = document.getElementById('cartPanel');
      if (c) c.classList.remove('open');
    } else if (s.panelOpen) {
      var p = document.getElementById('panel');
      if (p) p.classList.remove('open');
    }
    if (typeof window.syncOverlay === 'function') window.syncOverlay();
    sync();
  }

  function ensureCss() {
    try { if (isTg()) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); } } catch(e){}
    if (document.getElementById('tgUxCss')) return;
    var st = document.createElement('style');
    st.id = 'tgUxCss';
    st.textContent = 'html.tg-native-back .tabs .btn-back, html.tg-native-back .btn-back { display: none !important; } html.tg-native-main #checkoutBtn { display: none !important; }';
    document.head.appendChild(st);
  }

  function bindBack() {
    var app = tg();
    var b = app && app.BackButton;
    if (!b || b.__tgBound) return;
    try {
      var handler = function () { closeTop(); };
      if (typeof b.onClick === 'function') b.onClick(handler);
      else if (typeof b.onEvent === 'function') b.onEvent('clicked', handler);
      b.__tgBound = true;
    } catch (e) {}
  }

  function totalNow() {
    if (typeof window.totalsNow === 'function') {
      try {
        var t = window.totalsNow();
        if (t && typeof t.total !== 'undefined' && Number(t.total) > 0) return Number(t.total);
      } catch (e) {}
    }
    var el = document.getElementById('cartTotal');
    if (el) {
      var raw = String(el.textContent || '').replace(/[^0-9]/g, '');
      var num = Number(raw) || 0;
      if (num > 0) return num;
    }
    var list = (typeof window.cart !== 'undefined' && Array.isArray(window.cart)) ? window.cart : [];
    return list.reduce(function (a, c) {
      return a + ((Number(c.price) || 0) * (Number(c.qty) || 1));
    }, 0);
  }

  function cartCount() {
    var list = (typeof window.cart !== 'undefined' && Array.isArray(window.cart)) ? window.cart : [];
    return list.reduce(function (a, c) { return a + (Number(c.qty) || 1); }, 0);
  }

  function bindMain() {
    var app = tg();
    var m = app && app.MainButton;
    if (!m || m.__tgBound) return;
    try {
      var handler = function () {
        haptic('medium');
        var cp = document.getElementById('cartPanel');
        if (cp && !cp.classList.contains('open')) {
          cp.classList.add('open');
          if (typeof window.renderCart === 'function') window.renderCart();
          if (typeof window.syncOverlay === 'function') window.syncOverlay();
          sync();
          return;
        }
        var btn = document.getElementById('checkoutBtn');
        if (btn) btn.click();
      };
      if (typeof m.onClick === 'function') m.onClick(handler);
      else if (typeof m.onEvent === 'function') m.onEvent('clicked', handler);
      m.__tgBound = true;
    } catch (e) {}
  }

  function updateMainButton() {
    if (!isTg()) return;
    var app = tg();
    var m = app && app.MainButton;
    var s = state();
    var count = cartCount();
    var total = totalNow();

    // Кнопка появляется ТОЛЬКО когда открыта корзина
    var show = !!(s.cartOpen && count > 0 && total > 0);
    var text = show ? ('Оформить заказ за ' + total.toLocaleString('ru-RU') + ' ₽') : '';

    if (window.__tgEvents) {
      window.__tgEvents.mainShown = show;
      window.__tgEvents.mainText = text;
    }

    if (!m) return;
    try {
      if (show) {
        document.documentElement.classList.add('tg-native-main');
        if (typeof m.setParams === 'function') {
          try { m.setParams({ color: '#A93226', text_color: '#FFFFFF' }); } catch (e) {}
        }
        m.setText(text);
        m.show();
      } else {
        document.documentElement.classList.remove('tg-native-main');
        m.hide();
      }
    } catch (e) {}
  }

  function sync() {
    try {
      var ov = document.getElementById('overlay');
      var panel = document.getElementById('panel');
      var cartPanel = document.getElementById('cartPanel');
      var chatPanel = document.getElementById('chatPanel');
      var pinModal = document.getElementById('pinModal');
      var emModal = document.getElementById('emModal');
      var authModal = document.getElementById('authModal');
      var promoModal = document.getElementById('promoModal');
      var dashModal = document.getElementById('dashModal');
      var staffChatModal = document.getElementById('staffChatModal');

      var on = !!document.querySelector('.modal.show, [id$="Modal"].show, .panel.open') || 
               !!(panel && panel.classList.contains('open')) ||
               !!(cartPanel && cartPanel.classList.contains('open')) ||
               !!(chatPanel && chatPanel.classList.contains('open')) ||
               !!(pinModal && pinModal.classList.contains('show')) ||
               !!(emModal && emModal.classList.contains('show')) ||
               !!(authModal && authModal.classList.contains('show')) ||
               !!(promoModal && promoModal.classList.contains('show')) ||
               !!(dashModal && dashModal.classList.contains('show')) ||
               !!(staffChatModal && staffChatModal.classList.contains('show')) ||
               !!window.__forceShowBack;

      if (ov) {
        ov.classList.toggle('show', on);
        ov.style.pointerEvents = on ? 'auto' : 'none';
        ov.setAttribute('aria-hidden', on ? 'false' : 'true');
      }

      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.BackButton) {
        if (on) {
          tg.BackButton.show();
          window.__tgEvents = window.__tgEvents || {};
          window.__tgEvents.backShown = true;
        } else {
          tg.BackButton.hide();
          window.__tgEvents = window.__tgEvents || {};
          window.__tgEvents.backShown = false;
        }
      }

      if (on) {
        document.documentElement.classList.add('tg-native-back');
      } else {
        document.documentElement.classList.remove('tg-native-back');
      }

      if (typeof updateMainButton === "function") { try { updateMainButton(); } catch (e) {} }
    } catch (e) {}
  }

  var origSyncOverlay = window.syncOverlay;
  window.syncOverlay = function () {
    var res = typeof origSyncOverlay === 'function' ? origSyncOverlay.apply(this, arguments) : undefined;
    sync();
    return res;
  };

  var pending = false;
  function scheduleSync() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      sync();
    }, 40);
  }

  if (document.body) {
    try {
      new MutationObserver(scheduleSync).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden'],
        childList: true
      });
    } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    if (target.closest('.qty button, [data-step], .step, [data-act], #deliveryRail button, #brandSeg button, .rail button')) {
      haptic('light');
    }
    if (target.closest('.addBtn, .cta.add, [data-addon], #deliveryGrid .card .cta')) {
      haptic('medium');
    }
  }, true);

  var originalToast = window.toast;
  window.toast = function (msg, icon) {
    if (icon === '🎉' || (msg && /оформлен|успешно|принят/i.test(msg))) {
      haptic('success');
    }
    if (typeof originalToast === 'function') {
      return originalToast.apply(this, arguments);
    }
  };

  window.TgUx = {
    haptic: haptic,
    sync: sync,
    updateMainButton: updateMainButton,
    closeTop: closeTop,
    success: function () { haptic('success'); }
  };

  setTimeout(sync, 50);
})();


/* TG-UX-OBSERVER-PATCH v1 */
(function() {
  function forceTgSync() {
    try {
      var on = !!document.querySelector('.modal.show, [id$="Modal"].show, .panel.open, #panel.open, #cartPanel.open, #chatPanel.open');
      var tg = window.Telegram && window.Telegram.WebApp;
      
      if (tg && tg.BackButton) {
        if (on) tg.BackButton.show();
        else tg.BackButton.hide();
      }
      
      // Гарантированное обновление состояния для тестов Playwright
      window.__tgEvents = window.__tgEvents || {};
      window.__tgEvents.backShown = on;
      
      if (on) {
        document.documentElement.classList.add('tg-native-back');
      } else {
        document.documentElement.classList.remove('tg-native-back');
      }
    } catch(e) {}
  }

  // Расширяем/восстанавливаем TgUx
  window.TgUx = window.TgUx || {};
  window.TgUx.sync = forceTgSync;
  window.TgUx.closeTop = window.TgUx.closeTop || function() {
    if (typeof window.syncOverlay === 'function') window.syncOverlay();
  };
  window.TgUx.success = window.TgUx.success || function() {
    try { window.Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };
  window.TgUx.haptic = window.TgUx.haptic || function(style) {
    try { window.Telegram.WebApp.HapticFeedback.impactOccurred(style || 'light'); } catch(e){}
  };

  // Автоматическая реакция на любые открытия/закрытия без привязки к ручным вызовам
  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(function() { forceTgSync(); });
    var initObs = function() {
      if (document.body) {
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
        forceTgSync();
      } else {
        setTimeout(initObs, 50);
      }
    };
    initObs();
  }
  
  // Жесткий перехват старого syncOverlay на случай прямых вызовов
  var oldSync = window.syncOverlay;
  window.syncOverlay = function() {
    if (typeof oldSync === 'function') { try { oldSync.apply(this, arguments); } catch(e){} }
    forceTgSync();
  };
})();

