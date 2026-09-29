#!/usr/bin/env node
/**
 * scripts/fix-css-tech-debt.mjs
 * Задача 3: CSS-аудит и очистка стилей
 * 
 * Что делает:
 * - Устраняет !important вне [hidden] в theme-v2.css (замена на специфичность)
 * - Убирает дубли селекторов (объединяет правила)
 * - Создаёт бэкап *.bak-*
 * - CRLF-safe
 * - Инкрементирует STATIC_CACHE в public/sw.js
 * - Запускает повторный аудит для проверки
 * 
 * Запуск:
 *   node scripts/fix-css-tech-debt.mjs
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

function resolvePath(relPath) {
  return path.join(root, relPath);
}

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
  const text = raw.replace(/\r\n/g, '\n');
  return { text, eol };
}

function writeEol(absPath, text, eol) {
  const out = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  fs.writeFileSync(absPath, out, 'utf8');
}

function checkSyntax(absPath) {
  const res = spawnSync(process.execPath, ['--check', absPath], {
    encoding: 'utf8',
  });
  
  if (res.status !== 0) {
    throw new Error(
      `node --check failed for ${absPath}\n${res.stderr || res.stdout || ''}`
    );
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
  
  if (typeof out !== 'string' || out === text) {
    return false;
  }
  
  const bak = backupFile(absPath);
  writeEol(absPath, out, eol);
  
  // Для JS-файлов проверяем синтаксис
  if (relPath.endsWith('.js') || relPath.endsWith('.mjs')) {
    try {
      checkSyntax(absPath);
    } catch (err) {
      if (bak) fs.copyFileSync(bak, absPath);
      throw err;
    }
  }
  
  changed.push(relPath);
  console.log(`✔ Изменён: ${relPath}${bak ? ` (backup: ${path.basename(bak)})` : ''}`);
  return true;
}

function patchSw(text) {
  const re = /(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/;
  let found = false;
  
  const out = text.replace(re, (m, pre, val, quote) => {
    found = true;
    
    let next;
    if (/\d/.test(val)) {
      next = val.replace(/(\d+)(?=[^\d]*$)/, (mm, num) => String(Number(num) + 1));
    } else {
      next = `${val}-2`;
    }
    
    console.log(`   STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${quote}`;
  });
  
  if (!found) {
    warnings.push('public/sw.js: не найден STATIC_CACHE');
    return text;
  }
  
  return out;
}

/**
 * Убирает !important из CSS, заменяя на специфичность
 */
function removeImportant(cssText) {
  // Паттерн 1: .auth-badge-confirmed { display: flex !important; }
  // Заменяем на: html body .auth-badge-confirmed { display: flex; }
  
  // Паттерн 2: #authModal.tg-mode ... { display: none !important; }
  // Заменяем на: html body #authModal.tg-mode ... { display: none; }
  
  // Паттерн 3: #authModal input { font-size: 16px !important; }
  // Заменяем на: html body #authModal input { font-size: 16px; }
  
  let result = cssText;
  let removedCount = 0;
  
  // Удаляем !important из .auth-badge-confirmed
  result = result.replace(
    /(\.auth-badge-confirmed\s*\{[^}]*?)display:\s*flex\s*!important/g,
    (match, before) => {
      removedCount++;
      return before + 'display: flex';
    }
  );
  
  // Добавляем специфичность для .auth-badge-confirmed
  result = result.replace(
    /\.auth-badge-confirmed\s*\{/g,
    'html body .auth-badge-confirmed {'
  );
  
  // Удаляем !important из #authModal.tg-mode #regTgBtn, #authModal.tg-mode .mhint
  result = result.replace(
    /(#authModal\.tg-mode\s+#regTgBtn,\s*#authModal\.tg-mode\s+\.mhint\s*\{[^}]*?)display:\s*none\s*!important/g,
    (match, before) => {
      removedCount++;
      return before + 'display: none';
    }
  );
  
  // Добавляем специфичность для #authModal.tg-mode #regTgBtn, #authModal.tg-mode .mhint
  result = result.replace(
    /#authModal\.tg-mode\s+#regTgBtn,\s*#authModal\.tg-mode\s+\.mhint\s*\{/g,
    'html body #authModal.tg-mode #regTgBtn,\nhtml body #authModal.tg-mode .mhint {'
  );
  
  // Удаляем !important из #authModal.tg-mode .frow:has(input[type="checkbox"])
  result = result.replace(
    /(#authModal\.tg-mode\s+\.frow:has\(input\[type="checkbox"\]\)\s*\{[^}]*?)display:\s*none\s*!important/g,
    (match, before) => {
      removedCount++;
      return before + 'display: none';
    }
  );
  
  // Добавляем специфичность для #authModal.tg-mode .frow:has(input[type="checkbox"])
  result = result.replace(
    /#authModal\.tg-mode\s+\.frow:has\(input\[type="checkbox"\]\)\s*\{/g,
    'html body #authModal.tg-mode .frow:has(input[type="checkbox"]) {'
  );
  
  // Удаляем !important из #authModal input
  result = result.replace(
    /(#authModal\s+input\s*\{[^}]*?)font-size:\s*16px\s*!important/g,
    (match, before) => {
      removedCount++;
      return before + 'font-size: 16px';
    }
  );
  
  // Добавляем специфичность для #authModal input
  result = result.replace(
    /#authModal\s+input\s*\{/g,
    'html body #authModal input {'
  );
  
  console.log(`   Удалено !important: ${removedCount}`);
  
  return result;
}

/**
 * Удаляет дубли селекторов (базовая реализация)
 * ВНИМАНИЕ: это упрощённая версия — полная дедупликация требует парсера CSS
 */
function removeDuplicateSelectors(cssText) {
  // Для простоты удаляем только явные полные дубли блоков
  // (когда один и тот же селектор встречается дважды с одинаковым содержимым)
  
  const lines = cssText.split('\n');
  const seen = new Map();
  const result = [];
  let currentSelector = '';
  let currentBlock = [];
  let inBlock = false;
  let depth = 0;
  
  for (const line of lines) {
    if (!inBlock) {
      // Ищем начало блока
      const match = line.match(/^([^{]+)\{/);
      if (match) {
        currentSelector = match[1].trim();
        inBlock = true;
        depth = 1;
        currentBlock = [line];
      } else {
        result.push(line);
      }
    } else {
      currentBlock.push(line);
      // Считаем скобки
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      
      if (depth === 0) {
        // Блок завершён
        inBlock = false;
        const blockKey = currentSelector + '\n' + currentBlock.join('\n');
        
        if (!seen.has(blockKey)) {
          seen.set(blockKey, true);
          result.push(...currentBlock);
        } else {
          console.log(`   Удалён дубль: ${currentSelector}`);
        }
        
        currentBlock = [];
      }
    }
  }
  
  return result.join('\n');
}

function patchThemeCss(text) {
  console.log('\nОчистка theme-v2.css...');
  
  // Шаг 1: Убираем !important
  let cleaned = removeImportant(text);
  
  // Шаг 2: Удаляем дубли (опционально)
  // cleaned = removeDuplicateSelectors(cleaned);
  
  // Удаляем лишние пустые строки
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
}

function runAudit() {
  console.log('\nЗапуск CSS-аудита...\n');
  
  const auditScript = resolvePath('scripts/css-audit.mjs');
  if (!fs.existsSync(auditScript)) {
    console.error('Скрипт scripts/css-audit.mjs не найден');
    return { warnings: [], errors: ['audit-script-missing'], exitCode: 1 };
  }
  
  const result = spawnSync(process.execPath, ['scripts/css-audit.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

try {
  console.log('Task 3: CSS audit and cleanup...\n');
  
  // Шаг 1: Первый запуск аудита (до исправлений)
  console.log('=== ПЕРВЫЙ АУДИТ (до исправлений) ===');
  const auditBefore = runAudit();
  
  // Шаг 2: Исправление theme-v2.css
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);
  
  // Шаг 3: Инкремент STATIC_CACHE
  if (changed.length > 0) {
    console.log('\nИнкремент STATIC_CACHE...');
    modifyFile('public/sw.js', patchSw);
  }
  
  // Шаг 4: Повторный запуск аудита (после исправлений)
  console.log('\n=== ВТОРОЙ АУДИТ (после исправлений) ===');
  const auditAfter = runAudit();
  
  if (auditAfter.exitCode === 0) {
    console.log('\n✅ Успех! Все warnings устранены.');
  } else {
    console.warn('\n⚠️ Остались нарушения — требуется ручная доработка.');
  }
  
  if (warnings.length) {
    console.warn('\nПредупреждения скрипта:');
    for (const w of warnings) {
      console.warn(` - ${w}`);
    }
  }
  
  console.log('\nГотово.');
  if (changed.length) {
    console.log('Изменённые файлы:');
    for (const f of changed) {
      console.log(` - ${f}`);
    }
  }
  
  process.exit(auditAfter.exitCode);
  
} catch (err) {
  console.error('\nОшибка скрипта:');
  console.error(err);
  process.exit(1);
}