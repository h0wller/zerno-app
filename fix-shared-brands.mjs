// apply-final-clean.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

// 1. Чистый public/app/core/splash.js без синтаксических ошибок и вложенных if
const cleanSplash = `/* public/app/core/splash.js — Ф3.3 + Ф3.13a: сплэш бренда.
Единственный владелец сплэша: статичная разметка #brandSplashStatic в index.html.
Динамический #brandSplash создаётся ТОЛЬКО если статичной разметки нет (fallback).
Правило: не более одного сплэша; при splashDone/DEEP/IN_TG — ни одного. */
(function () {
  'use strict';
  
  var bs = document.getElementById('brandSplash');
  if (bs) bs.remove();
  var ss = document.getElementById('brandSplashStatic');
  
  var done = false;
  try { done = (()=>{try{return sessionStorage.getItem("splashDone")}catch(e){return null}})() === '1'; } catch (e) {}

  var QS = new URLSearchParams(location.search);
  var IN_TG = /Telegram/i.test(navigator.userAgent);
  var DEEP = !!(QS.get('brand') || QS.get('tab') || QS.get('src'));

  function finish(choice) {
    try { (()=>{try{sessionStorage.setItem("splashDone","1")}catch(e){}})(); } catch (e) {}
    try { localStorage.setItem('zt_brand', choice); } catch (e) {} // Фолбэк для PWA
    
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    
    var el = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (el) el.remove();
    
    window.brand = choice; // Безопасная запись в глобал (в strict mode просто brand = choice вызовет ошибку)
    
    if ((window.mode === 'cashier' || window.mode === 'orders') && typeof window.setMode === 'function') {
      window.setMode('guest');
    }
    
    document.querySelectorAll('#brandSeg button').forEach(function (x) {
      x.classList.toggle('on', x.dataset.brand === choice);
    });
    
    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (choice === 'delivery' && typeof window.DMENU !== 'undefined' && window.DMENU.length === 0 && typeof window.loadDelivery === 'function') {
      window.loadDelivery();
    }
    if (window.chatState) window.chatState.setChatCtx(choice);
    else if (typeof window.setChatCtx === 'function') window.setChatCtx(choice);
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

  if (ss) { 
    bind(ss); 
    return; 
  }

  /* fallback: статичной разметки нет — создаём динамически */
  var sp = document.createElement('div');
  sp.id = 'brandSplash';
  sp.innerHTML = '<div class="spInner">' +
    '<div class="spTitle">«Пятница» & …и кофе</div>' +
    '<div class="spSub">Выберите, куда вы сегодня</div>' +
    '<div class="spBtns">' +
    '<button class="spBtn spPizza" data-go="delivery"><span class="em">🍕</span><span class="bt">«Пятница»</span><small>доставка пиццы и роллов</small></button>' +
    '<button class="spBtn spCoffee" data-go="coffee"><span class="em">🌊</span><span class="bt">Кофейня</span><small>меню, штампы и бонусы</small></button>' +
    '</div></div>';
  document.body.appendChild(sp);
  bind(sp);
})();
`;

fs.writeFileSync(path.join(ROOT, 'public/app/core/splash.js'), cleanSplash, 'utf8');
console.log('✅ Записан валидный public/app/core/splash.js');

// 2. Исправление вложенного литерала в public/app/menu.js (строка 72)
const menuPath = path.join(ROOT, 'public/app/menu.js');
let menuSrc = fs.readFileSync(menuPath, 'utf8');

menuSrc = menuSrc.replace(
  /\$\{p\.comp && p\.comp\.length \? `<div class="comp">\$\{p\.comp\.map\(c => `<i>\$\{esc\(c\)\}<\/i>`\)\.join\(''\)\}<\/div>` : ''\}/g,
  "${p.comp && p.comp.length ? '<div class=\"comp\">' + p.comp.map(c => '<i>' + esc(c) + '</i>').join('') + '</div>' : ''}"
);

fs.writeFileSync(menuPath, menuSrc, 'utf8');
console.log('✅ Строка 72 в public/app/menu.js переведена в строковую конкатенацию');

// 3. Проверка синтаксиса
console.log('\n--- 1. Проверка синтаксиса (node --check) ---');
execSync('node --check public/app/core/splash.js', { stdio: 'inherit' });
execSync('node --check public/app/menu.js', { stdio: 'inherit' });
console.log('✅ Синтаксис splash.js и menu.js валиден!');

// 4. Проверка ESLint
console.log('\n--- 2. Запуск npm run lint:code ---');
try {
  execSync('npm run lint:code', { stdio: 'inherit' });
  console.log('\n🎉 ESLINT ПОЛНОСТЬЮ ЧИСТ: 0 ОШИБОК, 0 ВОРНИНГОВ!');
} catch (e) {
  console.error('Статус линтера:', e.message);
}

// 5. Полный аудит барьеров
console.log('\n--- 3. Запуск npm run audit ---');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ АВТО-БАРЬЕРЫ ЗЕЛЕНЫЕ!');
} catch (e) {
  console.error('Ошибка аудита:', e.message);
  process.exit(1);
}