#!/usr/bin/env node
/* scripts/consolidate-critical-css.mjs
   Консолидирует 5 <style> блоков из <head> в один <style id="critical-css">.
   
   Используется ПОСЛЕ ручной замены <link rel="stylesheet"> на async-версию.
   
   Запуск: node scripts/consolidate-critical-css.mjs
   Откат:  mv public/index.html.bak-consolidate public/index.html
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');
const BACKUP_FILE = INDEX_FILE + '.bak-consolidate';

if (!fs.existsSync(INDEX_FILE)) {
  console.error('❌ public/index.html не найден');
  process.exit(1);
}

let html = fs.readFileSync(INDEX_FILE, 'utf8');
fs.writeFileSync(BACKUP_FILE, html, 'utf8');
console.log(`✔ Бэкап сохранён: ${BACKUP_FILE}`);

// ─── 1. Разделяем <head> и <body> ───
const headStartMatch = html.match(/<head[^>]*>/i);
const headEndMatch = html.match(/<\/head>/i);
if (!headStartMatch || !headEndMatch) {
  console.error('❌ Не найдены границы <head>');
  process.exit(1);
}

const headStartIdx = headStartMatch.index + headStartMatch[0].length;
const headEndIdx = headEndMatch.index;
let headContent = html.slice(headStartIdx, headEndIdx);

// ─── 2. Надёжный парсер <style> блоков (посимвольный) ───
function findStyleBlocks(content) {
  const blocks = [];
  let searchPos = 0;
  
  while (true) {
    const openIdx = content.indexOf('<style', searchPos);
    if (openIdx === -1) break;
    
    // Проверяем, что это не внутри комментария или строки
    // (простая эвристика: предыдущий непробельный символ не должен быть '/')
    const beforeOpen = content.slice(Math.max(0, openIdx - 50), openIdx);
    if (beforeOpen.includes('/*') && !beforeOpen.includes('*/')) {
      searchPos = openIdx + 1;
      continue;
    }
    
    // Находим закрывающий > тега <style ...>
    const tagEndIdx = content.indexOf('>', openIdx);
    if (tagEndIdx === -1) break;
    
    // Находим </style>
    const closeIdx = content.indexOf('</style>', tagEndIdx);
    if (closeIdx === -1) break;
    
    const fullTag = content.slice(openIdx, closeIdx + '</style>'.length);
    const cssContent = content.slice(tagEndIdx + 1, closeIdx);
    
    // Извлекаем id если есть
    const idMatch = fullTag.match(/id=["']([^"']+)["']/i);
    const id = idMatch ? idMatch[1] : null;
    
    blocks.push({
      full: fullTag,
      content: cssContent,
      startIdx: openIdx,
      endIdx: closeIdx + '</style>'.length,
      id: id,
    });
    
    searchPos = closeIdx + '</style>'.length;
  }
  
  return blocks;
}

const styleBlocks = findStyleBlocks(headContent);
console.log(`✔ Найдено <style> блоков в <head>: ${styleBlocks.length}`);

// ─── 3. Фильтруем только нужные блоки (в <head>, не в <body>) ───
// Проверяем, что блок находится до </head>
const targetBlocks = styleBlocks.filter(b => b.startIdx < headContent.length);
console.log(`✔ Целевых блоков для консолидации: ${targetBlocks.length}`);

if (targetBlocks.length === 0) {
  console.warn('⚠️  Нет <style> блоков для консолидации');
  process.exit(0);
}

// Показываем, какие блоки найдены
targetBlocks.forEach((b, i) => {
  const preview = b.content.trim().slice(0, 80).replace(/\n/g, ' ');
  console.log(`  [${i + 1}] ${b.id || '(без id)'}: ${preview}...`);
});

// ─── 4. Консолидируем CSS ───
const consolidatedCSS = targetBlocks
  .map((b) => b.content.trim())
  .filter((s) => s.length > 0)
  .join('\n\n/* ─── boundary ─── */\n\n');

const criticalBlock = `\n<style id="critical-css">
/* ═══ CRITICAL ABOVE-THE-FOLD CSS ═══
   Консолидировано из ${targetBlocks.length} inline-блоков <head>.
   Остальные CSS грузятся async через <link rel="preload" as="style">. */

${consolidatedCSS}
</style>\n`;

// ─── 5. Удаляем старые блоки (с конца к началу) ───
for (let i = targetBlocks.length - 1; i >= 0; i--) {
  const block = targetBlocks[i];
  headContent = headContent.slice(0, block.startIdx) + headContent.slice(block.endIdx);
  console.log(`  → удалён блок #${targetBlocks.length - i} (${block.id || 'без id'})`);
}

// ─── 6. Вставляем консолидированный блок после <script id="zt-early-brand-guard"> ───
const brandGuardEnd = headContent.indexOf('</script>', headContent.indexOf('zt-early-brand-guard'));
if (brandGuardEnd === -1) {
  console.error('❌ Не найден </script> после zt-early-brand-guard');
  process.exit(1);
}

const insertPos = brandGuardEnd + '</script>'.length;
headContent = headContent.slice(0, insertPos) + criticalBlock + headContent.slice(insertPos);
console.log(`✔ Вставлен консолидированный блок после zt-early-brand-guard`);

// ─── 7. Собираем финальный HTML ───
const newHtml = 
  html.slice(0, headStartIdx) + 
  headContent + 
  html.slice(headEndIdx);

// ─── 8. Самопроверка ───
const checks = [
  { name: 'critical-css блок', re: /<style id="critical-css">/, expected: true },
  { name: 'brandSplashStatic', re: /id="brandSplashStatic"/, expected: true },
  { name: 'inline-владелец клика', re: /location\.replace\(u\.toString\(\)\)/, expected: true },
  { name: 'preload для async CSS', re: /rel="preload"[^>]*as="style"/, expected: true },
];

let allOk = true;
for (const c of checks) {
  const found = c.re.test(newHtml);
  const ok = found === c.expected;
  console.log(`${ok ? '✅' : '❌'} ${c.name}: ${found ? 'found' : 'not found'}`);
  if (!ok) allOk = false;
}

// Проверяем баланс <style> только в <head>
const finalHeadMatch = newHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
if (finalHeadMatch) {
  const finalHead = finalHeadMatch[1];
  const openStyles = (finalHead.match(/<style/g) || []).length;
  const closeStyles = (finalHead.match(/<\/style>/g) || []).length;
  console.log(`\n📊 <style> в <head>: ${openStyles} открыто, ${closeStyles} закрыто`);
  if (openStyles !== closeStyles) {
    console.error(`❌ Несовпадение тегов <style>`);
    allOk = false;
  }
}

const beforeSize = Buffer.byteLength(html, 'utf8');
const afterSize = Buffer.byteLength(newHtml, 'utf8');
console.log(`\n📊 Размер: ${beforeSize} → ${afterSize} bytes (${afterSize - beforeSize >= 0 ? '+' : ''}${afterSize - beforeSize})`);

if (!allOk) {
  console.error('\n❌ Самопроверка провалена. Бэкап сохранён, исходник НЕ изменён.');
  process.exit(1);
}

// ─── 9. Записываем ───
fs.writeFileSync(INDEX_FILE, newHtml, 'utf8');
console.log(`\n✅ Готово! Записано: ${INDEX_FILE}`);
console.log(`\n📝 Следующие шаги:`);
console.log(`   1. Поднимите STATIC_CACHE в public/sw.js`);
console.log(`   2. npm run test:e2e`);
console.log(`   3. Если что-то сломалось: mv ${BACKUP_FILE} ${INDEX_FILE}`);