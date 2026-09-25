/* public/app/core/boot.js — Ф5.5: точка входа и жизненный цикл приложения.
Было: inline-скрипт index.html (renderAll, boot-IIFE, SW-регистрация №1)
+ три инлайн-скрипта в <body> (install-баннер, iOS-хинт, SW-регистрация №2).
Зависимости на момент DOMContentLoaded: loadMenu/renderModes (inline-ядро),
renderRail/renderMenu (menu.js), renderBonus/renderProfile (profile.js),
renderChips (chat.js), renderVerifyNote (profile-brand.js), drawQR (qr.js),
showBadge/initChatPointer (chat.js), maybeAskReview (review.js), openAuth (auth.js). */
(function () {
'use strict';

/* ── 1. Агрегатная перерисовка всех видов ── */
function renderAll() {
renderRail();
renderMenu();
renderBonus();
renderProfile();
renderModes();
renderChips();
renderVerifyNote();
const s = (me && me.qr) || 'guest';
drawQR($('#qrMini'), s);
drawQR($('#qrMain'), s);
if (mode === 'cashier') renderLog();
}

/* ── 2. Точка входа: пользователь → меню → виды → бейджи → отзыв ── */
async function boot() {
if (USER_TOKEN) {
try {
me = (await api('/me')).customer;
} catch (e) {
me = null;
USER_TOKEN = null;
localStorage.removeItem(T_USER);
}
}
await loadMenu();
renderAll();
if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
showBadge();
initChatPointer();
maybeAskReview();
if (!onboarded) setTimeout(() => openAuth(false), 600);
}

/* ── 3. Service Worker: ЕДИНАЯ регистрация (F3.58, дедупликация двух инлайн-блоков).
reload только при АПДЕЙТЕ (когда уже был controller): первая активация
(clients.claim() в чистом профиле) не должна перезагружать страницу из-под пользователя/теста. ── */
function registerSW() {
if (!('serviceWorker' in navigator)) return;
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

/* ── 4. Install-баннер PWA (было инлайн в <body>) ── */
let _defPrompt = null;
function initInstallBanner() {
window.addEventListener('beforeinstallprompt', (e) => {
e.preventDefault();
_defPrompt = e;
const b = document.getElementById('installBanner');
if (b && !localStorage.getItem('zt_inst_hide')) b.hidden = false;
});
const btn = document.getElementById('installBtn');
if (btn) btn.onclick = async () => {
if (_defPrompt) {
_defPrompt.prompt();
await _defPrompt.userChoice;
_defPrompt = null;
}
const b = document.getElementById('installBanner');
if (b) b.hidden = true;
};
const cl = document.getElementById('installClose');
if (cl) cl.onclick = () => {
const b = document.getElementById('installBanner');
if (b) b.hidden = true;
localStorage.setItem('zt_inst_hide', '1');
};
if (
/iPhone|iPad|iPod/.test(navigator.userAgent) &&
!navigator.standalone &&
!localStorage.getItem('zt_inst_hide')
) {
const b = document.getElementById('installBanner');
if (b) {
b.hidden = false;
b.querySelector('span').innerHTML =
'🍏 Нажмите <b>Поделиться</b> → <b>На экран «Домой»</b> — и приложение на рабочем столе';
b.querySelector('#installBtn').style.display = 'none';
}
}
}

/* ── 5. iOS-хинт установки (было инлайн в <body>) ── */
function initIosHint() {
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
if (t) t.innerHTML = inApp
? '🍏 Чтобы установить приложение: нажмите <b>⋯</b> → <b>Открыть в Safari</b>, затем в Safari — <b>Поделиться</b> → <b>На экран «Домой»</b>'
: '🍏 Установите приложение: нажмите <b>Поделиться</b> (квадрат со стрелкой) → <b>На экран «Домой»</b> → <b>Добавить</b> — карта гостя всегда под рукой!';
if (h) h.hidden = false;
}, 800);
const cl = document.getElementById('iosHintClose');
if (cl) cl.onclick = function () {
const h = document.getElementById('iosHint');
if (h) h.hidden = true;
localStorage.setItem('zt_ios_hide', '1');
};
}

/* ── 6. Старт ── */
function onReady(fn) {
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
else fn();
}
onReady(function () {
initInstallBanner();
initIosHint();
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