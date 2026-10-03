// fix-padding.mjs
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

// 1. Убираем лишний отступ в public/index.html
const htmlPath = path.join(ROOT, 'public/index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (html.includes('padding-top: 142px !important;')) {
    html = html.replace(/padding-top:\s*142px\s*!important;/g, 'padding-top: 0 !important;');
    fs.writeFileSync(htmlPath, html, 'utf8');
    log('Отступ 142px убран из public/index.html');
  } else {
    log('В public/index.html отступ 142px не обнаружен (возможно, уже исправлен)');
  }
} else {
  console.error('❌ public/index.html не найден');
}

// 2. Обновляем шаблон в apply-perf-patch.mjs (чтобы при повторном запуске отступ не возвращался)
const patchScriptPath = path.join(ROOT, 'apply-perf-patch.mjs');
if (fs.existsSync(patchScriptPath)) {
  let scriptContent = fs.readFileSync(patchScriptPath, 'utf8');
  if (scriptContent.includes('padding-top: 142px !important;')) {
    scriptContent = scriptContent.replace(/padding-top:\s*142px\s*!important;/g, 'padding-top: 0 !important;');
    fs.writeFileSync(patchScriptPath, scriptContent, 'utf8');
    log('Шаблон в apply-perf-patch.mjs синхронизирован');
  }
}

// 3. Бампаем версию STATIC_CACHE в public/sw.js
const swPath = path.join(ROOT, 'public/sw.js');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf8');
  const updatedSw = swContent.replace(/STATIC_CACHE\s*=\s*['"]zerno-static-v(\d+)['"]/, (_m, num) => {
    const next = parseInt(num, 10) + 1;
    log(`STATIC_CACHE в sw.js: v${num} -> v${next}`);
    return `STATIC_CACHE = 'zerno-static-v${next}'`;
  });
  if (swContent !== updatedSw) {
    fs.writeFileSync(swPath, updatedSw, 'utf8');
  }
}

log('Готово! Обновите страницу в браузере (Ctrl + F5)');