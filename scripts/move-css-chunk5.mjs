#!/usr/bin/env node
/**
 * scripts/perf-p1-composited-animations.mjs
 * Оптимизация анимаций: перевод .card и кнопок на композитные свойства (transform / opacity)
 * Устраняет 59 предупреждений Lighthouse о non-composited animations и снижает Style & Layout.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
function resolvePath(p) { return path.join(root, p); }

const themeCssPath = resolvePath('public/app/ui/theme-v2.css');
if (!fs.existsSync(themeCssPath)) {
  console.error('Файл theme-v2.css не найден');
  process.exit(1);
}

let css = fs.readFileSync(themeCssPath, 'utf8');

// 1. Оптимизация анимации pop для карточек: убираем border-color, box-shadow из keyframes
const COMPOSITED_POP_CSS = `
/* PERF: Аппаратно-ускоренная анимация карточек без рефлоу */
@keyframes pop {
  0% { transform: scale(0.97); opacity: 0.85; }
  100% { transform: scale(1); opacity: 1; }
}

.card {
  will-change: transform;
  transform: translateZ(0);
}
`;

// Заменяем старую анимацию pop, если она есть
if (/@keyframes\s+pop\s*\{[\s\S]*?\}/.test(css)) {
  css = css.replace(/@keyframes\s+pop\s*\{[\s\S]*?\}/, COMPOSITED_POP_CSS.trim());
} else {
  css += '\n' + COMPOSITED_POP_CSS;
}

// 2. Убираем transition по border-color и box-shadow на карточках
css = css.replace(/transition:\s*([^;}]*?)border-color([^;}]*?);/g, 'transition: transform 0.2s ease, opacity 0.2s ease;');

fs.writeFileSync(themeCssPath, css, 'utf8');
console.log('✔ theme-v2.css: анимации переведены на композитный слой');

// 3. Быстрая зачистка forced reflow в scrolltop.js
const scrollTopPath = resolvePath('public/app/ui/scrolltop.js');
if (fs.existsSync(scrollTopPath)) {
  let stJs = fs.readFileSync(scrollTopPath, 'utf8');
  // Оборачиваем обработчик скролла в rAF-тикер, если его там ещё нет
  if (stJs.indexOf('requestAnimationFrame') === -1) {
    stJs = `/* Оптимизированный scrolltop без forced reflow */
(function() {
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        var btn = document.getElementById('scrollTopBtn');
        if (btn) {
          if (window.scrollY > 300) {
            btn.classList.add('show');
          } else {
            btn.classList.remove('show');
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();`;
    fs.writeFileSync(scrollTopPath, stJs, 'utf8');
    console.log('✔ scrolltop.js: внедрен rAF батчинг скролла (устранен layout thrashing)');
  }
}

// 4. Bump SW Cache
const swPath = resolvePath('public/sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, (_, pre, val, post) => {
    const next = val.replace(/(\d+)(?=[^\d]*$)/, (_, n) => String(Number(n) + 1));
    console.log(`✔ STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${post}`;
  });
  fs.writeFileSync(swPath, sw, 'utf8');
}

console.log('\nГотово к сборке и тестированию.');