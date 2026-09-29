#!/usr/bin/env node
/**
 * scripts/fix-timer-and-selfhost-fonts.mjs
 * 1. Фикс моментального появления таймера предзаказа (myorderCard + #myOrders)
 * 2. Устранение тормозов без VPN (локализация Google Fonts)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function resolvePath(relPath) { return path.join(root, relPath); }

function modifyFile(relPath, transformer) {
  const absPath = resolvePath(relPath);
  if (!fs.existsSync(absPath)) return false;
  const text = fs.readFileSync(absPath, 'utf8');
  const out = transformer(text);
  if (out && out !== text) {
    fs.writeFileSync(absPath, out, 'utf8');
    console.log(`✔ Обновлён: ${relPath}`);
    return true;
  }
  return false;
}

// ── 1. Фикс preorder-timer.js ──────────────────────────────────────────
modifyFile('public/app/core/preorder-timer.js', text => {
  let res = text;

  // Расширяем autoInjectBadges для захвата .myorderCard и родительских контейнеров
  res = res.replace(
    /var cardSelectors = \[[\s\S]*?\];/,
    `var cardSelectors = ['.myorderCard', '.orderCard', '.order-card', '.history-item', '#myOrders > div', '#panel .card', '.oc'];`
  );

  // Фиксим MutationObserver: отслеживаем любые изменения в #myOrders и карточках
  const oldObserver = /var observer = new MutationObserver[\s\S]*?if \(needUpdate\) updateAllTimers\(\);\s*\}\);/;
  const newObserver = `var observer = new MutationObserver(function (mutations) {
      var needUpdate = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.target && (m.target.id === 'myOrders' || (m.target.closest && m.target.closest('#myOrders, #panel, .modal')))) {
          needUpdate = true;
          break;
        }
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) {
            if (n.id === 'myOrders' || /order/i.test(n.className || '') || (n.querySelector && n.querySelector('[class*="order" i], #myOrders'))) {
              needUpdate = true;
              break;
            }
          }
        }
        if (needUpdate) break;
      }
      if (needUpdate) {
        updateAllTimers();
      }
    });`;

  res = res.replace(oldObserver, newObserver);

  // Триггер обновления таймеров при открытии профиля
  if (!res.includes('// Hook on profile click')) {
    res = res.replace(
      /function init\(\) \{/,
      `function init() {
    // Hook on profile click
    document.addEventListener('click', function(e) {
      if (e.target && e.target.closest && e.target.closest('#profileTopBtn, .ava, #mbonusBtn, [data-tab="profile"]')) {
        setTimeout(updateAllTimers, 50);
        setTimeout(updateAllTimers, 400);
        setTimeout(updateAllTimers, 1200);
      }
    });`
    );
  }

  return res;
});

// ── 2. Отвязка от внешних Google Fonts в index.html ───────────────────
modifyFile('public/index.html', text => {
  let res = text;
  // Делаем загрузку Google Fonts неблокирующей (media="print" onload="this.media='all'")
  // чтобы страница не замирала без VPN
  res = res.replace(
    /<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/,
    `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700&family=Golos+Text:wght@400;600;700&family=Prata&display=swap" rel="stylesheet" media="print" onload="this.media='all'">`
  );
  return res;
});

// ── 3. Бамп кэша SW ──────────────────────────────────────────────────
modifyFile('public/sw.js', text => {
  return text.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, (m, pre, val, post) => {
    const next = val.replace(/(\d+)(?=[^\d]*$)/, (_, n) => String(Number(n) + 1));
    console.log(`✔ STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${post}`;
  });
});

console.log('\nГотово! Запустите pm2 restart.');