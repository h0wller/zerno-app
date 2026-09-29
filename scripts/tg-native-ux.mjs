// scripts/fix-tg-native-ux-robust.mjs
// Полная и надёжная интеграция Telegram WebApp SDK (BackButton, MainButton, Haptic)
// Запуск: node scripts/fix-tg-native-ux-robust.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const INDEX_FILE = path.resolve('public/index.html');
const OVERLAY_FILE = path.resolve('public/app/core/overlay.js');
const SW_FILE = path.resolve('public/sw.js');

const BAK_INDEX = INDEX_FILE + '.bak-tg-ux-robust';
const BAK_OVERLAY = OVERLAY_FILE + '.bak-tg-ux-robust';
const BAK_SW = SW_FILE + '.bak-tg-ux-robust';

const MARKER = '// [tg-ux-controller-robust-v2]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(INDEX_FILE) || !fs.existsSync(OVERLAY_FILE) || !fs.existsSync(SW_FILE)) {
  console.error('Ошибка: не найдены обязательные файлы в public/');
  process.exit(1);
}

const indexData = readNorm(INDEX_FILE);
const overlayData = readNorm(OVERLAY_FILE);
const swData = readNorm(SW_FILE);

// ── 1. Подключение Telegram SDK в public/index.html ──
let patchedIndex = indexData.content;
if (!patchedIndex.includes('telegram-web-app.js')) {
  const FROM_INDEX = '<link rel="stylesheet" href="app/ui/theme-v2.css" />';
  const TO_INDEX = '<script src="https://telegram.org/js/telegram-web-app.js"></script>\n    <link rel="stylesheet" href="app/ui/theme-v2.css" />';
  if (patchedIndex.split(FROM_INDEX).length - 1 !== 1) {
    console.error('Якорь theme-v2.css не найден в public/index.html.');
    process.exit(1);
  }
  patchedIndex = patchedIndex.split(FROM_INDEX).join(TO_INDEX);
  fs.writeFileSync(BAK_INDEX, indexData.raw, 'utf8');
  writeNorm(INDEX_FILE, patchedIndex, indexData.isCRLF);
  console.log('✔ public/index.html: добавлен Telegram WebApp SDK.');
} else {
  console.log('✔ public/index.html: Telegram SDK уже подключён.');
}

// ── 2. Внедрение контроллера TgUx в public/app/core/overlay.js ──
const TG_CONTROLLER_CODE = `
${MARKER}
(function initTgNativeUx() {
  if (window.__tgUxReady) return;
  window.__tgUxReady = true;

  function tg() {
    return (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  }

  function isTg() {
    var app = tg();
    return !!(
      window.__isTgMiniApp ||
      window.__tgInitData ||
      (app && app.initData) ||
      (app && app.initDataUnsafe && app.initDataUnsafe.query_id)
    );
  }

  // Автоматический expand при входе
  try {
    var appInit = tg();
    if (appInit) {
      if (typeof appInit.ready === 'function') appInit.ready();
      if (typeof appInit.expand === 'function') appInit.expand();
    }
  } catch (e) {}

  function haptic(style) {
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
    var modal = document.querySelector('.modal.show');
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
    st.textContent = 'html.tg-native-back .tabs .btn-back, html.tg-native-back .btn-back { display: none !important; }';
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
    var el = document.getElementById('cartTotal');
    if (el) {
      var raw = String(el.textContent || '').replace(/[^0-9]/g, '');
      if (raw) return Number(raw) || 0;
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
    if (!m) return;
    var count = cartCount();
    var total = totalNow();
    try {
      if (count > 0 && total > 0) {
        m.setText('Оформить заказ за ' + total.toLocaleString('ru-RU') + ' ₽');
        m.show();
      } else {
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
    }
    updateMainButton();
  }

  var pending = false;
  function scheduleSync() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      sync();
    }, 60);
  }

  // Наблюдатель за DOM для автоматического обновления кнопок
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

  // Глобальное делегирование Haptic на действия гостя
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    // Степперы и переключатели: light
    if (target.closest('.qty button, [data-step], .step, [data-act], #deliveryRail button, #brandSeg button, .rail button')) {
      haptic('light');
    }
    // Добавление в корзину: medium
    if (target.closest('.addBtn, .cta.add, [data-addon], #deliveryGrid .card .cta')) {
      haptic('medium');
    }
  }, true);

  // Перехват window.toast для success-haptic при оформлении заказа
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

  setTimeout(sync, 100);
})();
`;

let patchedOverlay = overlayData.content;
if (!patchedOverlay.includes(MARKER)) {
  fs.writeFileSync(BAK_OVERLAY, overlayData.raw, 'utf8');
  patchedOverlay = patchedOverlay + '\n' + TG_CONTROLLER_CODE;
  writeNorm(OVERLAY_FILE, patchedOverlay, overlayData.isCRLF);
  console.log('✔ public/app/core/overlay.js: внедрён надёжный TgUx контроллер.');
} else {
  console.log('✔ public/app/core/overlay.js: TgUx контроллер уже актуален.');
}

// ── 3. Инкремент STATIC_CACHE в public/sw.js ──
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (!swMatch) {
  console.error('Не найден токен STATIC_CACHE в public/sw.js.');
  process.exit(1);
}
const oldVer = swMatch[0];
const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
const patchedSw = swData.content.replace(oldVer, newVer);

fs.writeFileSync(BAK_SW, swData.raw, 'utf8');
writeNorm(SW_FILE, patchedSw, swData.isCRLF);
console.log(`✔ public/sw.js: кэш обновлён ${oldVer} -> ${newVer}`);

// ── 4. Проверка синтаксиса ──
try {
  execSync('node --check ' + OVERLAY_FILE, { stdio: 'pipe' });
  execSync('node --check ' + SW_FILE, { stdio: 'pipe' });
  console.log('\nСинтаксис файлов проверен и корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(OVERLAY_FILE, overlayData.raw, 'utf8');
  fs.writeFileSync(SW_FILE, swData.raw, 'utf8');
  process.exit(1);
}

console.log('\nГотово! Telegram WebApp SDK и UX-контроллер активны.');