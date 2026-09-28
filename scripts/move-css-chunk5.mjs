/* scripts/fix-admin-bar.mjs — Ф5.48:
   1. Сетка 2х2 для кнопок adminBar на мобильных экранах (без лесенок и нахлёстов).
   2. Уменьшение высоты и отступов мобильных тостов.
   3. Инкремент STATIC_CACHE в sw.js.
*/
import fs from 'node:fs';

const TH_PATH = 'public/app/ui/theme-v2.css';
let th = fs.readFileSync(TH_PATH, 'utf8');

// Удаляем предыдущие патчи админ-бара
th = th.replace(/\/\* ── Ф5\.(46|47)[\s\S]*$/g, '');

const adminBarPatch = `/* ── Ф5.48: Сетка панели администратора (2х2 на мобиле) и микро-тосты ── */
.adminBar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 12px;
  flex-wrap: wrap;
}

@media (max-width: 820px) {
  .adminBar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 0 0 8px;
    width: 100%;
  }
  .adminBar button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: #fff;
    border: 1.5px solid var(--line);
    box-sizing: border-box;
  }
  #chatsToggle2 {
    grid-column: span 2;
  }

  /* Компактные тосты строго под шапкой */
  .toasts {
    top: calc(var(--topbar-h, 56px) + env(safe-area-inset-top, 0px) + 12px);
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100vw - 24px);
    pointer-events: none;
    z-index: 1100;
  }
  .toast {
    padding: 6px 12px;
    font-size: 11.5px;
    border-radius: 10px;
    gap: 6px;
    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
  }
}
`;

th = th.trimEnd() + '\n\n' + adminBarPatch + '\n';
fs.writeFileSync(TH_PATH, th, 'utf8');
console.log('✅ theme-v2.css: adminBar переведён в сетку 2x2, тосты оптимизированы');

// Инкремент STATIC_CACHE в sw.js
const SW_PATH = 'public/sw.js';
let sw = fs.readFileSync(SW_PATH, 'utf8');
sw = sw.replace(/zerno-static-v(\d+)/, (m, n) => 'zerno-static-v' + (parseInt(n, 10) + 1));
fs.writeFileSync(SW_PATH, sw, 'utf8');
console.log('✅ sw.js: STATIC_CACHE инкрементирован');