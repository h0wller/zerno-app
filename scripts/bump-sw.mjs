#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const swPath = 'public/sw.js';
const idxPath = 'public/index.html';

const sw = readFileSync(swPath, 'utf8');
const match = sw.match(/const STATIC_CACHE = ['"]zerno-static-v(\d+)['"]/);

if (!match) {
  console.error('❌ Не найден STATIC_CACHE в public/sw.js');
  process.exit(1);
}

const oldVer = parseInt(match[1], 10);
const newVer = oldVer + 1;

const nextSw = sw.replace(
  /const STATIC_CACHE = ['"]zerno-static-v\d+['"]/,
  `const STATIC_CACHE = 'zerno-static-v${newVer}'`
);
writeFileSync(swPath, nextSw, 'utf8');

// Синхронизируем ?v=newVer в public/index.html для гарантированного сброса кэша в Telegram WebView и iOS PWA
let idx = readFileSync(idxPath, 'utf8');
idx = idx
  .replace(/(\/app\/ui\/fonts\.css)(\?v=\d+)?/g, `$1?v=${newVer}`)
  .replace(/(\/?app\/ui\/theme-v2\.css)(\?v=\d+)?/g, `/app/ui/theme-v2.css?v=${newVer}`)
  .replace(/(\/app\/ui\/brand-tokens\.css)(\?v=\d+)?/g, `$1?v=${newVer}`)
  .replace(/(\.?\/?dist\/main\.bundle\.js)(\?v=\d+)?/g, `/dist/main.bundle.js?v=${newVer}`);
writeFileSync(idxPath, idx, 'utf8');

console.log(`✅ STATIC_CACHE и ассеты index.html обновлены: v${oldVer} → v${newVer}`);