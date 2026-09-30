#!/usr/bin/env node
/**
 * scripts/fix-tg-native.mjs
 * Исправляет детект Telegram SDK, разворачивание на весь экран и haptics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const resolvePath = (p) => path.join(root, p);

// 1. Патчим public/index.html
const indexPath = resolvePath('public/index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const oldDetectRe = /\/\* TG-OFFLOAD v3[\s\S]*?installStub\(\);\s*\}\s*\}\)\(\);<\/script>/;
const newDetectCode = `/* TG-OFFLOAD v4: надёжный детект Telegram Mini App */
  var q = location.search + location.hash;
  var inTg = false;
  try {
    inTg = /Telegram/i.test(navigator.userAgent) ||
      /[?&#]tgWebApp(Data|Platform|Version|BotId)=/i.test(q) ||
      Boolean(window.TelegramWebviewProxy) ||
      Boolean(window.TelegramGameProxy) ||
      Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.webApp) ||
      Boolean(window.Telegram && window.Telegram.WebApp && (window.Telegram.WebApp.initData || window.Telegram.WebApp.platform));
  } catch (e) { inTg = false; }
  window.__isTgMiniApp = inTg;

  function makeStub() {
    var noop = function () {};
    var btn = function () {
      return { text: '', isVisible: false, show: noop, hide: noop, enable: noop,
               disable: noop, setText: noop, setColor: noop, onClick: noop, offClick: noop };
    };
    return {
      isStub: true, readyState: 'ready', isExpanded: true,
      initData: '', initDataUnsafe: {}, version: '0.0', platform: 'web',
      colorScheme: 'light', themeParams: {},
      ready: noop, expand: noop, close: noop,
      enableClosingConfirmation: noop, disableVerticalSwipes: noop,
      setHeaderColor: noop, setBackgroundColor: noop,
      showPopup: noop, showAlert: noop,
      showConfirm: function () { return false; },
      openLink: noop, openTelegramLink: noop, openInvoice: noop,
      onEvent: noop, offEvent: noop,
      MainButton: btn(), BackButton: btn(),
      HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop }
    };
  }

  function installStub() {
    window.Telegram = window.Telegram || {};
    if (!window.Telegram.WebApp || window.Telegram.WebApp.isStub) {
      window.Telegram.WebApp = makeStub();
    }
  }

  if (inTg) {
    var s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.async = false;
    s.onload = function() {
      try {
        if (window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        }
      } catch(err) {}
    };
    s.onerror = installStub;
    document.head.appendChild(s);
  } else {
    installStub();
  }
})();</script>`;

if (oldDetectRe.test(indexHtml)) {
  indexHtml = indexHtml.replace(oldDetectRe, newDetectCode);
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log('✔ public/index.html: TG-OFFLOAD обновлён до v4 с вызовом ready() и expand()');
} else {
  console.warn('⚠ Не найден точный якорь TG-OFFLOAD v3 в index.html');
}

// 2. Патчим overlay.js: гарантируем expand() и корректный haptic
const overlayPath = resolvePath('public/app/core/overlay.js');
let overlayCode = fs.readFileSync(overlayPath, 'utf8');

overlayCode = overlayCode.replace(
  /function isTg\(\)\s*\{[\s\S]*?return\s+!!\(t\s*&&[\s\S]*?\);\s*\}/,
  `function isTg() {\n    var t = tg();\n    return !!(t && !t.isStub);\n  }`
);

if (!overlayCode.includes('window.Telegram.WebApp.expand()')) {
  overlayCode = overlayCode.replace(
    /function ensureCss\(\)\s*\{/,
    `function ensureCss() {\n    try { if (isTg()) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); } } catch(e){}`
  );
}

fs.writeFileSync(overlayPath, overlayCode, 'utf8');
console.log('✔ public/app/core/overlay.js: TgUx настроен на реальный expand() и haptics');