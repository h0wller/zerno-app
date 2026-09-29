#!/usr/bin/env node
/**
 * scripts/add-preorder-timer.mjs
 * Этап 2: Детализация предзаказов — таймер обратного отсчёта до слота доставки
 * v5: фильтр инфо-карточек заведения («Ежедневно 11:00–22:00») и блоков без слова «заказ»
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

function resolvePath(relPath) { return path.join(root, relPath); }

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
  return { text: raw.replace(/\r\n/g, '\n'), eol };
}

function writeEol(absPath, text, eol) {
  const out = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  fs.writeFileSync(absPath, out, 'utf8');
}

function checkSyntax(absPath) {
  const res = spawnSync(process.execPath, ['--check', absPath], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`node --check failed for ${absPath}\n${res.stderr || res.stdout || ''}`);
  }
}

function modifyFile(relPath, transformer) {
  const absPath = resolvePath(relPath);
  if (!fs.existsSync(absPath)) {
    warnings.push(`Файл не найден: ${relPath}`);
    return false;
  }
  const { text, eol } = readLf(absPath);
  const out = transformer(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(absPath);
  writeEol(absPath, out, eol);
  if (relPath.endsWith('.js') || relPath.endsWith('.mjs')) {
    try { checkSyntax(absPath); }
    catch (err) { if (bak) fs.copyFileSync(bak, absPath); throw err; }
  }
  changed.push(relPath);
  console.log(`✔ Изменён: ${relPath}${bak ? ` (backup: ${path.basename(bak)})` : ''}`);
  return true;
}

function createFile(relPath, content) {
  const absPath = resolvePath(relPath);
  if (fs.existsSync(absPath)) {
    warnings.push(`Файл уже существует: ${relPath}`);
    return false;
  }
  writeEol(absPath, content, '\n');
  if (relPath.endsWith('.js') || relPath.endsWith('.mjs')) {
    try { checkSyntax(absPath); }
    catch (err) { fs.unlinkSync(absPath); throw err; }
  }
  changed.push(relPath);
  console.log(`✔ Создан: ${relPath}`);
  return true;
}

function patchSw(text) {
  const re = /(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/;
  let found = false;
  const out = text.replace(re, (m, pre, val, quote) => {
    found = true;
    let next;
    if (/\d/.test(val)) {
      next = val.replace(/(\d+)(?=[^\d]*$)/, (_, num) => String(Number(num) + 1));
    } else { next = `${val}-2`; }
    console.log(`   STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${quote}`;
  });
  if (!found) warnings.push('public/sw.js: не найден STATIC_CACHE');
  return found ? out : text;
}

function patchSwAssets(text) {
  if (text.includes("'/app/core/preorder-timer.js'")) return text;
  const re = /(const STATIC_ASSETS = \[[\s\S]*?)('\/app\/core\/overlay\.js',)/;
  const out = text.replace(re, (m, before, overlayLine) => {
    return before + "'/app/core/preorder-timer.js',\n  " + overlayLine;
  });
  return out === text ? text : out;
}

const PREORDER_TIMER_JS = `/* public/app/core/preorder-timer.js — Этап 2: таймер обратного отсчёта до слота доставки
   PREORDER-TIMER v5 — фильтр инфо-карточек заведения и блоков без слова «заказ» */
(function () {
  'use strict';

  var UPDATE_INTERVAL = 30000;
  var timerId = null;

  /**
   * Парсит строку слота. Поддерживает форматы:
   *   "29.09 | 14:00–14:30"
   *   "29.09.2026 | 14:00–14:30"
   *   "Сегодня (29.09) · 13:00 – 13:30"
   *   "Завтра (30.09) · 14:00 – 14:30"
   *   "13:00 – 13:30" (только время)
   */
  function parseSlot(slotStr) {
    if (!slotStr || slotStr === 'asap' || slotStr === 'Как можно скорее (~45 мин)') return null;

    var raw = String(slotStr).trim();

    // Убираем префиксы «Сегодня»/«Завтра» со скобками с датой
    raw = raw.replace(/^(Сегодня|Завтра)\\s*\\(\\s*([^)]+)\\s*\\)\\s*[·•|.\\-\\s]+/i, '$2 | ');
    // Префиксы без скобок
    raw = raw.replace(/^(Сегодня|Завтра)\\s*[·•|.\\-\\s]+/i, '');

    // Разделяем по «|» или «·»
    var parts = raw.split(/[|·•]/);
    var datePart = '';
    var timePart = '';

    if (parts.length >= 2) {
      datePart = parts[0].trim();
      timePart = parts.slice(1).join('·').trim();
    } else {
      datePart = '';
      timePart = raw;
    }

    var timeMatch = timePart.match(/(\\d{1,2}):(\\d{2})\\s*[–\\-\\s]+\\s*(\\d{1,2}):(\\d{2})/);
    if (!timeMatch) return null;

    var startH = parseInt(timeMatch[1], 10);
    var startM = parseInt(timeMatch[2], 10);
    var endH = parseInt(timeMatch[3], 10);
    var endM = parseInt(timeMatch[4], 10);

    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var day = now.getDate();

    if (datePart) {
      var dateMatch = datePart.match(/(\\d{1,2})[.\\-\\/](\\d{1,2})(?:[.\\-\\/](\\d{2,4}))?/);
      if (dateMatch) {
        day = parseInt(dateMatch[1], 10);
        month = parseInt(dateMatch[2], 10) - 1;
        if (dateMatch[3]) {
          year = parseInt(dateMatch[3], 10);
          if (year < 100) year += 2000;
        } else {
          var testDate = new Date(year, month, day);
          if (testDate < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) {
            year += 1;
          }
        }
      }
    }

    var start = new Date(year, month, day, startH, startM, 0, 0);
    var end = new Date(year, month, day, endH, endM, 0, 0);

    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    return { start: start, end: end };
  }

  function formatRemaining(ms) {
    if (ms <= 0) return null;
    var totalMin = Math.floor(ms / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    if (hours > 0) return '~' + hours + ' ч ' + mins + ' мин';
    if (mins <= 0) return 'меньше минуты';
    return '~' + mins + ' мин';
  }

  /**
   * PREORDER-TIMER v5: АВТОПОИСК карточек с предзаказами прямо в DOM.
   * Ищет по тексту карточки время в формате "14:00 – 14:30" / "14:00–14:30".
   * Игнорирует:
   *   - неактивные заказы (отменён, доставлен, выполнен, завершён)
   *   - инфо-карточки заведения («Ежедневно 11:00–22:00», «Режим работы», «Работаем»)
   *   - блоки без слова «заказ»
   */
  function autoInjectBadges() {
    var cardSelectors = [
      '.orderCard',
      '.order-card',
      '.history-item',
      '#panel [class*="order"]',
      '.oc',
      '#panel .card'
    ];

    cardSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (card) {
        // Уже есть бейдж — пропускаем
        if (card.querySelector('.preorder-timer')) return;

        var txt = card.textContent || '';

        /* PREORDER-TIMER v5: игнорируем неактивные заказы */
        if (/отмен|доставлен|выполнен|завершен/i.test(txt)) return;

        /* PREORDER-TIMER v5: игнорируем инфо-карточки заведения и блоки без слова "заказ" */
        if (/ежедневно|режим\\s+работы|работаем/i.test(txt) || !/заказ/i.test(txt)) return;

        // Ищем слот: опциональная дата + интервал времени
        var slotMatch = txt.match(
          /(?:Сегодня|Завтра|\\d{1,2}[.\\-\\/]\\d{1,2}(?:[.\\-\\/]\\d{2,4})?)?[^0-9\\n]*\\d{1,2}:\\d{2}\\s*[–\\-]\\s*\\d{1,2}:\\d{2}/i
        );

        if (slotMatch) {
          var badgeHtml = createTimerBadge(slotMatch[0]);
          if (badgeHtml) {
            var t = document.createElement('div');
            t.innerHTML = badgeHtml;
            if (t.firstElementChild) {
              card.appendChild(t.firstElementChild);
            }
          }
        }
      });
    });
  }

  function updateAllTimers() {
    // Сначала автопоиск новых карточек (PREORDER-TIMER v5)
    autoInjectBadges();

    var badges = document.querySelectorAll('.preorder-timer[data-slot]');
    var now = Date.now();

    badges.forEach(function (badge) {
      var slotStr = badge.dataset.slot;
      var parsed = parseSlot(slotStr);
      if (!parsed) {
        badge.hidden = true;
        return;
      }

      var msToStart = parsed.start.getTime() - now;
      var msToEnd = parsed.end.getTime() - now;

      if (msToStart > 0) {
        var remaining = formatRemaining(msToStart);
        if (remaining) {
          badge.hidden = false;
          badge.textContent = '⏱ До доставки ' + remaining;
          badge.classList.remove('preorder-timer-active', 'preorder-timer-way');
          badge.classList.add('preorder-timer-waiting');
        } else {
          badge.hidden = true;
        }
      } else if (msToEnd > 0) {
        badge.hidden = false;
        badge.textContent = '🚗 Курьер уже в пути';
        badge.classList.remove('preorder-timer-waiting');
        badge.classList.add('preorder-timer-active', 'preorder-timer-way');
      } else {
        badge.hidden = true;
      }
    });
  }

  function createTimerBadge(slotStr) {
    if (!slotStr || slotStr === 'asap') return '';
    var parsed = parseSlot(slotStr);
    if (!parsed) return '';
    var now = Date.now();
    if (parsed.end.getTime() - now <= 0) return '';
    return '<div class="preorder-timer preorder-timer-waiting" data-slot="' +
      String(slotStr).replace(/"/g, '&quot;').replace(/</g, '&lt;') +
      '">⏱ Загрузка...</div>';
  }

  function init() {
    autoInjectBadges();
    updateAllTimers();

    timerId = setInterval(updateAllTimers, UPDATE_INTERVAL);

    // MutationObserver следит за появлением новых карточек
    var observer = new MutationObserver(function (mutations) {
      var needUpdate = false;
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.classList) {
              if (node.classList.contains('orderCard') ||
                  node.classList.contains('order-card') ||
                  node.classList.contains('history-item') ||
                  node.classList.contains('oc')) {
                needUpdate = true;
              }
            }
            if (node.querySelector &&
                node.querySelector('.orderCard, .order-card, .history-item, .oc')) {
              needUpdate = true;
            }
          }
        });
      });
      if (needUpdate) updateAllTimers();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PreorderTimer = {
    parseSlot: parseSlot,
    formatRemaining: formatRemaining,
    createTimerBadge: createTimerBadge,
    updateAll: updateAllTimers
  };
})();
`;

const PREORDER_TIMER_CSS = `
/* ── PREORDER-TIMER v5: бейдж таймера предзаказа ── */
.preorder-timer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  margin-top: 8px;
  animation: preorder-timer-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition: background 0.3s, color 0.3s;
}

.preorder-timer-waiting {
  background: #FFF6E5;
  color: #B26A05;
  border: 1.5px dashed #F2D9A5;
}

.preorder-timer-active,
.preorder-timer-way {
  background: #E4EFE2;
  color: #1E7A4E;
  border: 1.5px solid #A8D5A0;
}

@keyframes preorder-timer-in {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: none; }
}

.preorder-timer-waiting {
  animation: preorder-timer-in 0.3s both, preorder-pulse 2s ease-in-out infinite;
}

@keyframes preorder-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.8; }
}

@media (prefers-reduced-motion: reduce) {
  .preorder-timer,
  .preorder-timer-waiting {
    animation: none;
  }
}
`;

function patchThemeCss(text) {
  if (text.includes('PREORDER-TIMER v5')) return text;
  return text.trimEnd() + `\n/* PREORDER-TIMER v5 */${PREORDER_TIMER_CSS}`;
}

function patchIndexHtml(text) {
  if (text.includes('/app/core/preorder-timer.js')) return text;
  const re = /(<script[^>]*src=["'][^"']*overlay\.js["'][^>]*><\/script>)/;
  const match = text.match(re);
  if (match) {
    const insertPoint = match.index + match[0].length;
    return text.slice(0, insertPoint) + '\n<script src="/app/core/preorder-timer.js" defer></script>' + text.slice(insertPoint);
  }
  if (text.includes('</body>')) {
    return text.replace('</body>', '<script src="/app/core/preorder-timer.js" defer></script>\n</body>');
  }
  warnings.push('public/index.html: не найдено место для вставки preorder-timer.js');
  return text;
}

/**
 * Патч cart.js: безопасная проверка слота БЕЗ isPreorder
 */
function patchCartJs(text) {
  if (text.includes('PREORDER-TIMER v5')) return text;

  let result = text;

  const checkoutSuccess = /toast\(["']Заказ #["']\s*\+\s*r\.order\.no\s*\+\s*["'] оформлен!["'],\s*["']🎉["']\);/;

  if (checkoutSuccess.test(result)) {
    result = result.replace(checkoutSuccess, (match) => {
      return match + `
      /* PREORDER-TIMER v5: если предзаказ — запускаем обновление таймеров */
      try {
        var preorderSlot = document.getElementById('checkoutSlot') ? document.getElementById('checkoutSlot').value : '';
        if (preorderSlot && preorderSlot !== 'asap' && window.PreorderTimer && typeof window.PreorderTimer.updateAll === 'function') {
          setTimeout(window.PreorderTimer.updateAll, 500);
        }
      } catch (e) {}`;
    });
  }

  return result;
}

try {
  console.log('Task 2.2: Preorder timer (v5 — фильтр инфо-карточек заведения)...\n');

  const requiredFiles = [
    'public/app/ui/theme-v2.css',
    'public/app/cart.js',
    'public/index.html',
    'public/sw.js'
  ];
  for (const f of requiredFiles) {
    if (!fs.existsSync(resolvePath(f))) {
      console.error(`❌ Критично: файл не найден: ${f}`);
      process.exit(1);
    }
  }

  const coreDir = resolvePath('public/app/core');
  if (!fs.existsSync(coreDir)) fs.mkdirSync(coreDir, { recursive: true });

  console.log('\nСоздание public/app/core/preorder-timer.js (v5)...');
  createFile('public/app/core/preorder-timer.js', PREORDER_TIMER_JS);

  console.log('\nДобавление CSS для бейджа таймера...');
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

  console.log('\nПодключение в public/index.html...');
  modifyFile('public/index.html', patchIndexHtml);

  console.log('\nПатч public/app/cart.js (безопасная проверка слота)...');
  modifyFile('public/app/cart.js', patchCartJs);

  console.log('\nДобавление в STATIC_ASSETS...');
  modifyFile('public/sw.js', patchSwAssets);

  if (changed.length > 0) {
    console.log('\nИнкремент STATIC_CACHE...');
    modifyFile('public/sw.js', patchSw);
  }

  if (warnings.length) {
    console.warn('\nПредупреждения:');
    warnings.forEach(w => console.warn(` - ${w}`));
  }

  if (changed.length) {
    console.log('\nИзменённые файлы:');
    changed.forEach(f => console.log(` - ${f}`));
  }

  console.log('\nГотово.\n');
  process.exit(0);

} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}