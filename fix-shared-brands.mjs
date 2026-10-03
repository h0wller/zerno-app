#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function findRoot() {
  const dirs = [path.resolve(__dirname, '..'), __dirname, process.cwd()];
  for (const d of dirs) {
    if (fsSync.existsSync(path.join(d, 'public', 'index.html'))) return d;
  }
  return null;
}
const ROOT = findRoot();
if (!ROOT) {
  console.error('❌ Корень проекта не найден');
  process.exit(1);
}

const C = { g: '\x1b[32m', rst: '\x1b[0m' };

async function run() {
  const cssPath = path.join(ROOT, 'public', 'app', 'ui', 'theme-v2.css');
  let content = await fs.readFile(cssPath, 'utf8');

  // Удаляем предыдущий блок стабилизации
  content = content.replace(/\/\* ── CLS-AND-HEADER-SEARCH-STABILIZATION ──[\s\S]*?\/\* ── END STABILIZATION ── \*\//g, '');

  const patch = `
/* ── CLS-AND-HEADER-SEARCH-STABILIZATION ── */

/* 1. Мобильная шапка (<= 690px): фиксация элементов для исключения CLS */
@media (max-width: 690px) {
  header.topbar {
    position: relative;
  }
  header.topbar div.venueWrap {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
  }
  header.topbar button#venueToggle.venueToggle {
    width: 44px;
    max-width: 44px;
    overflow: hidden;
    white-space: nowrap;
    padding: 0;
    justify-content: center;
  }
  header.topbar button#venueToggle.venueToggle span.vt-label {
    display: none;
  }
  header.topbar button#profileTopBtn.ava {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    margin: 0;
  }
  header.topbar div#headerBrand.brand {
    margin: 0 auto;
    width: fit-content;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  header.topbar div#headerBrand.brand div.mark {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
  }
}

/* 2. Адаптив поиска: перенос под заголовок только на истинных мобильных (<= 820px), на планшетах/десктопе — в строку */
@media (max-width: 820px) {
  div#menuView div.menu-head div.mh-top,
  div#deliveryView div.menu-head div.mh-top,
  div.menu-head div.mh-top {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    height: auto;
    min-height: 0;
  }
  div#menuView div.mh-top h1,
  div#deliveryView div.mh-top h1,
  div.menu-head div.mh-top h1 {
    font-size: clamp(20px, 4vw, 28px);
    line-height: 1.25;
    margin: 0;
  }
  div#menuView div.mh-top div.mh-right,
  div#deliveryView div.mh-top div.mh-right,
  div.menu-head div.mh-top div.mh-right {
    width: 100%;
    margin: 0;
    display: block;
  }
  div#menuView div.mh-top div.mh-right div.search,
  div#deliveryView div.mh-top div.mh-right div.search,
  div#menuView div.mh-top div.search,
  div#deliveryView div.mh-top div.search,
  div.menu-head div.search {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    flex: 1 1 auto;
    margin: 0;
    box-sizing: border-box;
  }
  div#menuView div.search input,
  div#deliveryView div.search input,
  div.menu-head div.search input {
    width: 100%;
    box-sizing: border-box;
  }
}
/* ── END STABILIZATION ── */
`;

  content = content.trimEnd() + '\n' + patch;
  await fs.writeFile(cssPath, content, 'utf8');
  console.log(`${C.g}✓ theme-v2.css: брейкпоинт поиска скорректирован на 820px${C.rst}`);

  // Бамп версии Service Worker
  const swPath = path.join(ROOT, 'public', 'sw.js');
  let swContent = await fs.readFile(swPath, 'utf8');
  const match = swContent.match(/zerno-static-v(\d+)/);
  if (match) {
    const cur = parseInt(match[1], 10);
    const next = cur + 1;
    swContent = swContent.replace(`zerno-static-v${cur}`, `zerno-static-v${next}`);
    await fs.writeFile(swPath, swContent, 'utf8');
    console.log(`${C.g}✓ sw.js: кэш обновлен (v${cur} → v${next})${C.rst}`);
  }
}

run().catch((e) => {
  console.error('Ошибка:', e);
  process.exit(1);
});