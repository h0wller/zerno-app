// scripts/cleanup-tg-ux-duplicate.mjs
// Удаление дубликата старого TG-UX-PATCH v1 и фиксация единого контроллера TgUx
// Запуск: node scripts/cleanup-tg-ux-duplicate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OVERLAY_FILE = path.resolve('public/app/core/overlay.js');
const SW_FILE = path.resolve('public/sw.js');
const BAK_OVERLAY = OVERLAY_FILE + '.bak-clean-dup';
const BAK_SW = SW_FILE + '.bak-clean-dup';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

const overlayData = readNorm(OVERLAY_FILE);
let text = overlayData.content;

// 1. Вырезаем старый TG-UX-PATCH v1, если он присутствует
const v1Start = text.indexOf('/* TG-UX-PATCH v1:');
if (v1Start !== -1) {
  const v1EndMarker = '})();';
  const v1End = text.indexOf(v1EndMarker, v1Start);
  if (v1End !== -1) {
    text = text.slice(0, v1Start) + text.slice(v1End + v1EndMarker.length);
    console.log('✔ public/app/core/overlay.js: старый блок TG-UX-PATCH v1 удалён.');
  }
}

// 2. Удаляем любые промежуточные маркеры robust-v2
if (text.includes('// [tg-ux-controller-robust-v2]')) {
  const v2Idx = text.indexOf('// [tg-ux-controller-robust-v2]');
  text = text.slice(0, v2Idx);
}

// 3. Формируем единый, чистый и надежный TgUx контроллер
const SINGLE_TG_UX = `// [tg-ux-controller-final-v1]
(function initTgNativeUx() {
  if (window.__tgUxActive) return;
  window.__tgUxActive = true;

  function tg() {
    return (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  }

  function isTg() {
    var app = tg();
    return !!(
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
    if (!isTg()) return;
    ensureCss();
    bindBack();
    bindMain();
    var s = state();
    var open = !!(s.modal || s.cartOpen || s.panelOpen);

    if (window.__tgEvents) {
      window.__tgEvents.backShown = open;
    }

    var app = tg();
    var b = app && app.BackButton;
    if (b) {
      try {
        if (open) {
          b.show();
          document.documentElement.classList.add('tg-native-back');
        } else {
          b.hide();
          document.documentElement.classList.remove('tg-native-back');
        }
      } catch (e) {}
    } else {
      if (open) document.documentElement.classList.add('tg-native-back');
      else document.documentElement.classList.remove('tg-native-back');
    }
    updateMainButton();
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
`;

// Заменяем блок v3 или аппендим единый контроллер
const v3Marker = '// [tg-ux-controller-robust-v3]';
if (text.includes(v3Marker)) {
  const parts = text.split(v3Marker);
  text = parts[0].trimEnd() + '\n\n' + SINGLE_TG_UX;
} else if (!text.includes('// [tg-ux-controller-final-v1]')) {
  text = text.trimEnd() + '\n\n' + SINGLE_TG_UX;
}

fs.writeFileSync(BAK_OVERLAY, overlayData.raw, 'utf8');
writeNorm(OVERLAY_FILE, text, overlayData.isCRLF);
console.log('✔ public/app/core/overlay.js: единый финальный контроллер зафиксирован.');

// 4. Инкремент STATIC_CACHE в sw.js
const swData = readNorm(SW_FILE);
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (swMatch) {
  const oldVer = swMatch[0];
  const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
  const patchedSw = swData.content.replace(oldVer, newVer);
  fs.writeFileSync(BAK_SW, swData.raw, 'utf8');
  writeNorm(SW_FILE, patchedSw, swData.isCRLF);
  console.log(`✔ public/sw.js: кэш обновлён ${oldVer} -> ${newVer}`);
}

try {
  execSync('node --check ' + OVERLAY_FILE, { stdio: 'pipe' });
  console.log('✔ Синтаксис overlay.js проверен и корректен.');
} catch (e) {
  console.error('Ошибка синтаксиса:', e.message);
  process.exit(1);
}