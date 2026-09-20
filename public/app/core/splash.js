/* public/app/core/splash.js — Ф3.3 + Ф3.13a: сплэш бренда.
Единственный владелец сплэша: статичная разметка #brandSplashStatic в index.html.
Динамический #brandSplash создаётся ТОЛЬКО если статичной разметки нет (fallback).
Правило: не более одного сплэша; при splashDone/DEEP/IN_TG — ни одного. */
(function () {
'use strict';
var bs = document.getElementById('brandSplash');
if (bs) bs.remove();
var ss = document.getElementById('brandSplashStatic');
var done = sessionStorage.getItem('splashDone') === '1';
var QS = new URLSearchParams(location.search);
var IN_TG = /Telegram/i.test(navigator.userAgent);
var DEEP = !!(QS.get('brand') || QS.get('tab') || QS.get('src'));
function finish(choice) {
sessionStorage.setItem('splashDone', '1');
document.documentElement.classList.remove('need-splash');
document.documentElement.classList.add('no-splash');
var el = document.getElementById('brandSplashStatic')|| document.getElementById('brandSplash');
if (el) el.remove();
brand = choice;
try { localStorage.setItem('zt_brand', brand); } catch (e) {}
if (mode === 'cashier' || mode === 'orders') setMode('guest');
document.querySelectorAll('#brandSeg button').forEach(function (x) {
x.classList.toggle('on', x.dataset.brand === brand);
});
if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
if (brand === 'delivery' && !DMENU.length) loadDelivery();
if (window.chatState) window.chatState.setChatCtx(brand);
else if (typeof window.setChatCtx === 'function') window.setChatCtx(brand);
}
function bind(root) {
root.addEventListener('click', function (e) {
var b = e.target.closest('[data-go]');
if (!b) return;
finish(b.dataset.go);
});
}
if (done || DEEP || IN_TG) {
if (ss) ss.remove();
document.documentElement.classList.remove('need-splash');
document.documentElement.classList.add('no-splash');
return;
}
if (ss) { bind(ss); return; }
/* fallback: статичной разметки нет — создаём динамически */
var sp = document.createElement('div');
sp.id = 'brandSplash';
sp.innerHTML = '<div class="spInner">' +
'<div class="spTitle">«Пятница» & …и кофе</div>' +
'<div class="spSub">Выберите, куда вы сегодня</div>' +
'<div class="spBtns">' +
'<button class="spBtn spPizza" data-go="delivery">🍕<br><br>«Пятница»<small>доставка пиццы и роллов</small></button>' +
'<button class="spBtn spCoffee" data-go="coffee">🌊<br><br>Кофейня<small>меню, штампы и бонусы</small></button>' +
'</div></div>';
document.body.appendChild(sp);
bind(sp);
})();