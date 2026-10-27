import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve('public/app');

// Белый список и строгие квоты активных MutationObserver (ADR-008 / F5.71)
const ALLOWLIST = {
  'public/app/cashier.js': 1,           // локальный контейнер cash-view
  'public/app/core/chat-head.js': 1,    // самоотключающийся класс шапки чата
  'public/app/core/overlay-core.js': 1, // изолированный #cartPanel в TG
  'public/app/core/swipe.js': 1,        // самоотключающийся хинт первого свайпа
  'public/app/core/views.js': 1,        // центральный координатор шторки #panel
};

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

function scanDir(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDir(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function runAudit() {
  const files = scanDir(APP_DIR);
  const errors = [];
  let observedTotal = 0;

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const rawContent = fs.readFileSync(file, 'utf8');
    const cleanContent = stripComments(rawContent);

    // 1. Запрет на глобальные цели (document.body, documentElement и fallback || document.body)
    const forbiddenTargetRegex = /\.observe\s*\(\s*(document\.(body|documentElement)|[^)]*\|\|\s*document\.body)/g;
    if (forbiddenTargetRegex.test(cleanContent)) {
      errors.push(`❌ ${relPath}: обнаружен запрещённый таргетинг на document.body!`);
    }

    // 2. Контроль квоты new MutationObserver
    const matches = cleanContent.match(/\bnew\s+MutationObserver\b/g) || [];
    const count = matches.length;
    observedTotal += count;

    const allowed = ALLOWLIST[relPath] || 0;
    if (count > allowed) {
      errors.push(`❌ ${relPath}: найдено ${count} MutationObserver (лимит по ADR-008: ${allowed}).`);
    }
  }

  // 3. Контроль устаревания реестра: если обсервер был удалён из кода, квота должна быть снижена
  for (const [relPath, allowed] of Object.entries(ALLOWLIST)) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = stripComments(fs.readFileSync(fullPath, 'utf8'));
    const actual = (content.match(/\bnew\s+MutationObserver\b/g) || []).length;
    if (actual < allowed) {
      errors.push(`⚠️ ${relPath}: квота ${allowed}, но обнаружено всего ${actual}. Уменьшите значение в ALLOWLIST.`);
    }
  }

  if (errors.length > 0) {
    console.error('\n💥 Нарушения правил реактивности DOM (ADR-008):');
    errors.forEach((err) => console.error(err));
    process.exit(1);
  } else {
    console.log(`✅ MutationObserver: цели изолированы, квота соблюдена (${observedTotal}/5 экземпляров)`);
  }
}

runAudit();