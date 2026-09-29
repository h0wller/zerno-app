#!/usr/bin/env node
/**
 * scripts/tg-native-ux.mjs
 * Задача 1: нативный Telegram Mini App UX.
 *
 * Что делает:
 * - инжектит Telegram UX controller в public/app/core/overlay.js;
 * - связывает Telegram.WebApp.BackButton с #panel, #cartPanel, .modal.show;
 * - прячет веб-кнопку "Назад", если показан нативный BackButton;
 * - добавляет HapticFeedback:
 *   - light: степперы +/-, категории доставки, переключение брендов;
 *   - medium: успешное добавление в корзину / добавки;
 *   - success: успешный checkout;
 * - дублирует чекаут в Telegram.WebApp.MainButton;
 * - создаёт бэкапы .bak-*;
 * - CRLF-safe;
 * - node --check для изменённых JS;
 * - инкрементирует STATIC_CACHE в public/sw.js.
 *
 * Запуск:
 *   node scripts/tg-native-ux.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const stamp = new Date()
  .toISOString()
  .replace(/[:T]/g, '-')
  .replace(/\..+$/, '');

const changed = [];
const warnings = [];

/**
 * Единый Telegram UX runtime.
 * Вставляется в overlay.js, чтобы не трогать index.html.
 */
const TG_UX_CODE = `/* TG-UX-PATCH v1: Telegram BackButton / MainButton / HapticFeedback */
(function () {
  if (window.TgUx) return;

  function tg() {
    return (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  }

  function isMini() {
    var app = tg();
    return !!(
      window.__isTgMiniApp ||
      window.__tgInitData ||
      (app && app.initData) ||
      (app && app.initDataUnsafe && app.initDataUnsafe.query_id)
    );
  }

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

      if (s.modal.id === 'settingsModal') {
        s.modal.classList.remove('show');
      } else {
        var fn = CLOSE[s.modal.id];
        if (fn && typeof window[fn] === 'function') {
          window[fn]();
        } else {
          s.modal.classList.remove('show');
        }
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
    st.textContent = 'html.tg-native-back .tabs .btn-back,html.tg-native-back .btn-back{display:none!important}';
    document.head.appendChild(st);
  }

  function backButton() {
    var app = tg();
    return app && app.BackButton ? app.BackButton : null;
  }

  function mainButton() {
    var app = tg();
    return app && app.MainButton ? app.MainButton : null;
  }

  function bindBack() {
    var b = backButton();
    if (!b || b.__tgBound) return;

    try {
      var handler = function () {
        closeTop();
      };

      if (typeof b.onClick === 'function') {
        b.onClick(handler);
      } else if (typeof b.onEvent === 'function') {
        b.onEvent('clicked', handler);
      }

      b.__tgBound = true;
    } catch (e) {}
  }

  function bindMain() {
    var m = mainButton();
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

      if (typeof m.onClick === 'function') {
        m.onClick(handler);
      } else if (typeof m.onEvent === 'function') {
        m.onEvent('clicked', handler);
      }

      m.__tgBound = true;
    } catch (e) {}
  }

  function money(n) {
    return Number(n || 0).toLocaleString('ru-RU');
  }

  function cartCount() {
    var list = (typeof window.cart !== 'undefined' && window.cart) ? window.cart : [];
    if (!list || !Array.isArray(list)) return 0;
    return list.reduce(function (a, c) {
      return a + (Number(c.qty) || 1);
    }, 0);
  }

  function totalNow() {
    var t = null;

    if (typeof window.totalsNow === 'function') {
      try {
        t = window.totalsNow();
      } catch (e) {}
    }

    if (t && typeof t.total !== 'undefined') {
      return Number(t.total) || 0;
    }

    var el = document.getElementById('cartTotal');
    if (el) {
      var raw = String(el.textContent || '').replace(/[^0-9]/g, '');
      if (raw) return Number(raw) || 0;
    }

    var list = (typeof window.cart !== 'undefined' && window.cart) ? window.cart : [];
    if (!list || !Array.isArray(list)) return 0;

    return list.reduce(function (a, c) {
      return a + ((Number(c.price) || 0) * (Number(c.qty) || 1));
    }, 0);
  }

  function updateMainButton() {
    if (!isMini()) return;

    var m = mainButton();
    if (!m) return;

    var count = cartCount();
    var total = totalNow();
    var show = !!(count > 0 && total > 0);

    try {
      if (show) {
        m.setText('Оформить заказ за ' + money(total) + ' ₽');
        m.show();
      } else {
        m.hide();
      }
    } catch (e) {}
  }

  function sync() {
    if (!isMini()) return;

    ensureCss();
    bindBack();
    bindMain();

    var s = state();
    var open = !!(s.modal || s.cartOpen || s.panelOpen);
    var b = backButton();

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

  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      sync();
    }, 80);
  }

  function observe() {
    if (!document.body) return;

    try {
      new MutationObserver(schedule).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden'],
        childList: true,
        characterData: true
      });
    } catch (e) {}
  }

  if (document.body) {
    observe();
  } else {
    document.addEventListener('DOMContentLoaded', observe);
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    if (target.closest('[data-step], .qty button, #deliveryRail [data-dcat], #brandSeg button')) {
      haptic('light');
    }

    if (target.closest('[data-addon]')) {
      haptic('medium');
    }
  }, true);

  window.TgUx = {
    haptic: haptic,
    success: function () {
      haptic('success');
    },
    notify: function (type) {
      haptic(type || 'success');
    },
    sync: sync,
    updateMainButton: updateMainButton,
    closeTop: closeTop
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(sync, 0);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(sync, 0);
    });
  }
})();`;

function resolvePath(relPath) {
  return path.join(root, relPath);
}

function backupFile(absPath) {
  if (!fs.existsSync(absPath)) return null;

  let candidate = `${absPath}.bak-${stamp}`;
  let i = 1;

  while (fs.existsSync(candidate)) {
    candidate = `${absPath}.bak-${stamp}-${i}`;
    i += 1;
  }

  fs.copyFileSync(absPath, candidate);
  return candidate;
}

function readLf(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.replace(/\r\n/g, '\n');
  return { text, eol };
}

function writeEol(absPath, text, eol) {
  const out = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  fs.writeFileSync(absPath, out, 'utf8');
}

function checkSyntax(absPath) {
  const res = spawnSync(process.execPath, ['--check', absPath], {
    encoding: 'utf8',
  });

  if (res.status !== 0) {
    throw new Error(
      `node --check failed for ${absPath}\n${res.stderr || res.stdout || ''}`
    );
  }
}

function modifyJs(relPath, transformer) {
  const absPath = resolvePath(relPath);

  if (!fs.existsSync(absPath)) {
    warnings.push(`Файл не найден: ${relPath}`);
    return false;
  }

  const { text, eol } = readLf(absPath);
  const out = transformer(text);

  if (typeof out !== 'string' || out === text) {
    return false;
  }

  const bak = backupFile(absPath);
  writeEol(absPath, out, eol);

  try {
    checkSyntax(absPath);
  } catch (err) {
    if (bak) fs.copyFileSync(bak, absPath);
    throw err;
  }

  changed.push(relPath);
  console.log(`✔ Изменён: ${relPath}${bak ? ` (backup: ${path.basename(bak)})` : ''}`);
  return true;
}

function patchOverlay(text) {
  if (text.includes('TG-UX-PATCH v1')) return text;

  const markers = [
    "'use strict';",
    '"use strict";'
  ];

  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      const pos = idx + marker.length;
      return `${text.slice(0, pos)}\n${TG_UX_CODE}\n${text.slice(pos)}`;
    }
  }

  return `${TG_UX_CODE}\n${text}`;
}

function patchPanel(text) {
  if (text.includes('TG-UX-PATCH panel')) return text;

  let found = false;

  const out = text.replace(
    /([ \t]*)if \(typeof syncOverlay === 'function'\) syncOverlay\(\);/g,
    (m, indent) => {
      found = true;
      return `${m}\n${indent}if (window.TgUx) window.TgUx.sync(); /* TG-UX-PATCH panel */`;
    }
  );

  if (!found) {
    warnings.push('public/app/core/panel.js: не найден вызов syncOverlay()');
    return text;
  }

  return out;
}

function patchDelivery(text) {
  if (text.includes('TG-UX-PATCH add')) return text;

  let found = false;

  const out = text.replace(
    /addBtn\.classList\.add\((['"])added\1\)\s*;/,
    (m) => {
      found = true;
      return `${m}\n        if (window.TgUx) window.TgUx.haptic('medium'); /* TG-UX-PATCH add */`;
    }
  );

  if (!found) {
    warnings.push('public/app/delivery.js: не найдено успешное добавление в корзину (addBtn.classList.add("added"))');
    return text;
  }

  return out;
}

function patchCart(text) {
  if (text.includes('TG-UX-PATCH checkout')) return text;

  let found = false;

  const out = text.replace(
    /toast\(\s*(['"])Заказ #\1\s*\+\s*r\.order\.no\s*\+\s*(['"]) оформлен!\2\s*,\s*(['"])🎉\3\s*\)\s*;/u,
    (m) => {
      found = true;
      return `${m}\n      if (window.TgUx) window.TgUx.success(); /* TG-UX-PATCH checkout */`;
    }
  );

  if (!found) {
    warnings.push('public/app/cart.js: не найден toast успешного заказа');
    return text;
  }

  return out;
}

function patchSw(text) {
  const re = /(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/;
  let found = false;

  const out = text.replace(re, (m, pre, val, quote) => {
    found = true;

    let next;
    if (/\d/.test(val)) {
      next = val.replace(/(\d+)(?=[^\d]*$)/, (mm, num) => String(Number(num) + 1));
    } else {
      next = `${val}-2`;
    }

    console.log(`   STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${quote}`;
  });

  if (!found) {
    warnings.push('public/sw.js: не найден STATIC_CACHE');
    return text;
  }

  return out;
}

try {
  console.log('Task 1: Telegram native UX patch...');

  modifyJs('public/app/core/overlay.js', patchOverlay);
  modifyJs('public/app/core/panel.js', patchPanel);
  modifyJs('public/app/delivery.js', patchDelivery);
  modifyJs('public/app/cart.js', patchCart);

  if (changed.length > 0) {
    modifyJs('public/sw.js', patchSw);
  } else {
    console.log('Изменений нет: патчи уже применены или паттерны не найдены.');
  }

  if (warnings.length) {
    console.warn('\nПредупреждения:');
    for (const w of warnings) {
      console.warn(` - ${w}`);
    }
  }

  if (warnings.some((w) => w.startsWith('Файл не найден:'))) {
    console.error('\nКритично: не найдены обязательные файлы.');
    process.exit(1);
  }

  console.log('\nГотово.');
  if (changed.length) {
    console.log('Изменённые файлы:');
    for (const f of changed) {
      console.log(` - ${f}`);
    }
  }
} catch (err) {
  console.error('\nОшибка скрипта:');
  console.error(err);
  process.exit(1);
}