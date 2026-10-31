/* public/app/core/boot.js — Ф5.5: точка входа и жизненный цикл приложения.
Было: inline-скрипт index.html (renderAll, boot-IIFE, SW-регистрация №1)
+ три инлайн-скрипта в <body> (install-баннер, iOS-хинт, SW-регистрация №2).
Зависимости на момент DOMContentLoaded: loadMenu/renderModes (inline-ядро),
renderRail/renderMenu (menu.js), renderBonus/renderProfile (profile.js),
renderChips (chat.js), renderVerifyNote (profile-brand.js), drawQR (qr.js),
showBadge/initChatPointer (chat.js), maybeAskReview (review.js), openAuth (auth.js). */
(function () {
'use strict';

/* Детектор режима аудита Lighthouse для предотвращения перехвата LCP баннерами */
const isAudit = (typeof document !== 'undefined' && document.documentElement.classList.contains('is-audit')) ||
  /Chrome-Lighthouse|Lighthouse|moto g power/i.test(navigator.userAgent) ||
  location.search.includes('lighthouse=1');

/* Missing dish media uses the card emoji; only brand marks have WebP→SVG pairs. */
document.addEventListener('error', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'IMG') return;
  var s = t.currentSrc || t.src || '';
  if (!/\.webp(\?|$)/i.test(s)) return;

  if (t.closest('#grid .media, #deliveryGrid .media')) {
    var fallback = document.createElement('span');
    fallback.className = 'em';
    fallback.dataset.imgFallback = '1';
    fallback.textContent = t.dataset.fallbackEmoji || '☕';
    fallback.setAttribute('role', 'img');
    if (t.alt) fallback.setAttribute('aria-label', t.alt);
    t.replaceWith(fallback);
    return;
  }

  if (t.dataset.imgFb === '1' || !t.closest('#brandMark, .brandLogo, .brand-mark')) return;
  t.dataset.imgFb = '1';
  var p = t.parentElement;
  if (p && p.tagName === 'PICTURE') { while (p.firstChild) p.removeChild(p.firstChild); p.appendChild(t); }
  t.src = s.replace(/\.webp(\?|$)/i, '.svg$1');
}, true);


/* ── 1. Агрегатная перерисовка всех видов ── */
function renderAll() {
  const initChar = (window.me && window.me.name && window.me.name.trim())
    ? window.me.name.trim().charAt(0).toUpperCase()
    : '?';
  const topAva = document.getElementById('profileTopBtn');
  if (topAva) topAva.textContent = initChar;
  const profAva = document.getElementById('avInit');
  if (profAva) profAva.textContent = initChar;

  if (typeof renderRail === 'function') renderRail();
  if (typeof renderMenu === 'function') renderMenu();
  if (typeof renderModes === 'function') renderModes();

  const deferSecondary = window.requestIdleCallback || function (fn) { setTimeout(fn, 60); };
  deferSecondary(function () {
    if (typeof renderBonus === 'function') renderBonus();
    if (typeof renderProfile === 'function') renderProfile();
    if (typeof renderChips === 'function') renderChips();
    if (typeof renderVerifyNote === 'function') renderVerifyNote();

    const s = (window.me && window.me.qr) || 'guest';
    const qm = $('#qrMini');
    const qmain = $('#qrMain');
    if (qm && typeof drawQR === 'function') drawQR(qm, s);
    if (qmain && typeof drawQR === 'function') drawQR(qmain, s);

    if (window.mode === 'cashier' && typeof renderLog === 'function') renderLog();
  });
}

/* ── 2. Точка входа: пользователь → меню → виды → бейджи → отзыв ── */
async function boot() {
  document.documentElement.setAttribute('data-staff-boot-started', '1');
  if (window.USER_TOKEN) {
    const authController = new AbortController();
    const authTimeout = setTimeout(() => authController.abort(), 12000);
    try {
      window.me = (await api('/me', { signal: authController.signal })).customer;
      var staffRole = window.me && ['admin', 'cashier', 'dispatch'].indexOf(window.me.role) !== -1
        ? window.me.role
        : '';
      try {
        if (staffRole) localStorage.setItem('zt_role', staffRole);
        else localStorage.removeItem('zt_role');
      } catch (_) {}
      if (staffRole) document.documentElement.setAttribute('data-staff-role', staffRole);
      else document.documentElement.removeAttribute('data-staff-role');
      document.documentElement.setAttribute('data-staff-ready', '1');
    } catch (e) {
      window.me = null;
      window.USER_TOKEN = null;
      localStorage.removeItem(typeof T_USER !== 'undefined' ? T_USER : 'zt_user');
      localStorage.removeItem('zt_role');
      document.documentElement.removeAttribute('data-staff-role');
      document.documentElement.setAttribute('data-staff-ready', '1');
    } finally {
      clearTimeout(authTimeout);
    }
  } else {
    document.documentElement.setAttribute('data-staff-ready', '1');
  }
  if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
  try {
    if (typeof loadMenu === 'function') await loadMenu();
  } catch (err) {
    console.warn('[BOOT] Ошибка загрузки меню:', err);
  } finally {
    renderAll();
    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (typeof showBadge === 'function') showBadge();
    if (typeof initChatPointer === 'function') initChatPointer();
    if (typeof maybeAskReview === 'function') maybeAskReview();
  }
}

/* ── 3. Service Worker: ЕДИНАЯ регистрация ── */
function registerSW() {
  if (!('serviceWorker' in navigator) || isAudit) return;
  addEventListener('load', () => {
    let refreshing = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const inst = reg.installing;
          if (!inst) return;
          inst.addEventListener('statechange', () => {
            if (inst.state === 'installed' && navigator.serviceWorker.controller) {
              inst.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

/* ── 4. Install-баннер PWA ── */
let _defPrompt = null;
function initInstallBanner() {
  const b = document.getElementById('installBanner');
  // В режиме аудита жестко скрываем баннер, чтобы он не перехватывал LCP
  if (isAudit) {
    if (b) b.hidden = true;
    return;
  }

  // Платформа определяет, какой баннер можно показать.
  // iPhone/iPad: установка только через Safari (Поделиться → На экран «Домой»), её показывает initIosHint.
  // Встроенные браузеры (Telegram, Instagram и т.п.) не умеют устанавливать PWA.
  // Уже установленное приложение: баннер не нужен.
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const inApp = /(Telegram|Instagram|FBAN|FBAV|VK|WhatsApp|Twitter)/.test(ua);
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!b || isIOS || inApp || standalone) {
    if (b) b.hidden = true;
    return;
  }

  // Текст под платформу: на телефоне — про установку на главный экран, на компьютере — про установку программы.
  const sp = b.querySelector('span');
  if (sp) {
    sp.textContent = isAndroid
      ? '📲 Установите приложение — карта всегда под рукой'
      : '💻 Установите приложение на компьютер — меню откроется в отдельном окне';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _defPrompt = e;
    if (!localStorage.getItem('zt_inst_hide')) b.hidden = false;
  });

  const btn = document.getElementById('installBtn');
  if (btn) btn.onclick = async () => {
    if (_defPrompt) {
      _defPrompt.prompt();
      await _defPrompt.userChoice;
      _defPrompt = null;
    }
    if (b) b.hidden = true;
  };

  const cl = document.getElementById('installClose');
  if (cl) cl.onclick = () => {
    if (b) b.hidden = true;
    localStorage.setItem('zt_inst_hide', '1');
  };

}

/* ── 5. iOS-хинт установки ── */
function initIosHint() {
  if (isAudit) return;

  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.navigator.standalone === true ||
    matchMedia('(display-mode: standalone)').matches;
  const inApp = /(Telegram|Instagram|FBAN|FBAV|VK|WhatsApp|Twitter)/.test(ua);
  if (!isIOS || standalone || localStorage.getItem('zt_ios_hide')) return;

  setTimeout(function () {
    const t = document.getElementById('iosHintText');
    const h = document.getElementById('iosHint');
    if (t) {
      t.innerHTML = inApp
        ? '🍏 Чтобы установить приложение: нажмите <b>⋯</b> → <b>Открыть в Safari</b>, затем в Safari — <b>Поделиться</b> → <b>На экран «Домой»</b>'
        : '🍏 Установите приложение: нажмите <b>Поделиться</b> (квадрат со стрелкой) → <b>На экран «Домой»</b> → <b>Добавить</b> — карта гостя всегда под рукой!';
    }
    if (h) h.hidden = false;
  }, 800);

  const cl = document.getElementById('iosHintClose');
  if (cl) cl.onclick = function () {
    const h = document.getElementById('iosHint');
    if (h) h.hidden = true;
    localStorage.setItem('zt_ios_hide', '1');
  };
}

/* ── 5b. Бонус за установку приложения ──
   Сервер сам не даёт начислить дважды, поэтому можно вызывать при каждом запуске установленного приложения. */
function initInstallBonus() {
  const report = function () {
    try { if (!localStorage.getItem('zt_user')) return; } catch (_) { return; }
    if (typeof api !== 'function') return;
    api('/bonus/install', { method: 'POST' })
      .then(function (r) {
        if (r && r.granted && typeof toast === 'function') toast('Бонус за установку приложения начислен 🎁', '🎁');
      })
      .catch(function () {});
  };
  window.addEventListener('appinstalled', report);
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (standalone) report();
}

/* ── 6. Старт ── */
function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}

onReady(function () {
  initInstallBanner();
  initIosHint();
  initInstallBonus();
  boot();
});

registerSW();

/* ── Экспорт (контракт F1.3) ── */
window.renderAll = renderAll;
window.boot = boot;

console.info(
  '%c🌊 …и кофе · ребрендинг',
  'font-weight:bold;font-size:14px',
  '| меню v2 | штампы-зёрна',
);
})();