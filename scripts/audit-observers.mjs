import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const APP_DIR = path.resolve('public/app');
const HTML_PATH = path.resolve('public/index.html');

// Белый список и строгие квоты активных MutationObserver (ADR-008 / F5.71).
// Inline bootstrap code has no component lifecycle and cannot own observers.
const ALLOWLIST = {
  'public/app/cashier.js': 1,           // локальный контейнер cash-view
  'public/app/core/chat-head.js': 1,    // самоотключающийся класс шапки чата
  'public/app/core/overlay-core.js': 1, // изолированный #cartPanel в TG
  'public/app/core/swipe.js': 0,        // подсказка удалена; обработчик жеста не создаёт наблюдателей
  'public/app/core/views.js': 1,        // центральный координатор шторки #panel
};

const JS_MIME_TYPE = /^(?:text|application)\/(?:java|ecma)script(?:\s*;|$)/i;

function findTagEnd(html, start) {
  let quote = null;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return index;
    }
  }
  return -1;
}

function parseAttributes(tag) {
  const attributes = new Map();
  let index = 7; // immediately after <script
  const end = tag.length - 1;

  while (index < end) {
    while (index < end && /\s|\//.test(tag[index])) index += 1;
    const start = index;
    while (index < end && !/[\s=/>]/.test(tag[index])) index += 1;
    if (start === index) {
      index += 1;
      continue;
    }

    const name = tag.slice(start, index).toLowerCase();
    while (index < end && /\s/.test(tag[index])) index += 1;
    let value = '';
    if (tag[index] === '=') {
      index += 1;
      while (index < end && /\s/.test(tag[index])) index += 1;
      const quote = tag[index] === '"' || tag[index] === "'" ? tag[index++] : null;
      const valueStart = index;
      if (quote) {
        while (index < end && tag[index] !== quote) index += 1;
        value = tag.slice(valueStart, index);
        index += 1;
      } else {
        while (index < end && !/[\s>]/.test(tag[index])) index += 1;
        value = tag.slice(valueStart, index);
      }
    }
    attributes.set(name, value);
  }
  return attributes;
}

function findClosingScriptTag(html, start) {
  let index = start;
  while ((index = html.indexOf('<', index)) !== -1) {
    if (html[index + 1] !== '/') {
      index += 1;
      continue;
    }
    const nameStart = index + 2;
    if (html.slice(nameStart, nameStart + 6).toLowerCase() !== 'script') {
      index += 2;
      continue;
    }
    const boundary = html[nameStart + 6];
    if (boundary && !/[\s/>]/.test(boundary)) {
      index += 2;
      continue;
    }
    const tagEnd = findTagEnd(html, nameStart + 6);
    return { start: index, end: tagEnd === -1 ? html.length : tagEnd + 1 };
  }
  return { start: html.length, end: html.length };
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') line += 1;
  }
  return line;
}

function isExecutableScript(attributes) {
  if (attributes.has('src')) return false;
  const type = (attributes.get('type') || '').trim();
  return !type || type.toLowerCase() === 'module' || JS_MIME_TYPE.test(type);
}

function extractInlineScripts(html) {
  const scripts = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;
  let inlineIndex = 0;

  while (cursor < html.length) {
    const start = lowerHtml.indexOf('<script', cursor);
    if (start === -1) break;
    const boundary = html[start + 7];
    if (boundary && !/[\s/>]/.test(boundary)) {
      cursor = start + 7;
      continue;
    }

    const tagEnd = findTagEnd(html, start + 7);
    if (tagEnd === -1) break;
    const attributes = parseAttributes(html.slice(start, tagEnd + 1));
    const contentStart = tagEnd + 1;
    const closing = findClosingScriptTag(html, contentStart);

    if (isExecutableScript(attributes)) {
      inlineIndex += 1;
      scripts.push({
        index: inlineIndex,
        id: attributes.get('id') || null,
        line: lineAt(html, start),
        sourceType: (attributes.get('type') || '').trim().toLowerCase() === 'module' ? 'module' : 'script',
        content: html.slice(contentStart, closing.start)
      });
    }

    if (closing.end <= cursor) break;
    cursor = closing.end;
  }
  return scripts;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    if (value && typeof value === 'object') walk(value, visit);
  }
}

function memberName(node) {
  if (!node || node.type !== 'MemberExpression') return null;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return null;
}

function isDocumentGlobalTarget(node) {
  if (!node || node.type !== 'MemberExpression') return false;
  return node.object.type === 'Identifier' && node.object.name === 'document' &&
    ['body', 'documentElement'].includes(memberName(node));
}

function containsDocumentGlobalTarget(node) {
  let found = false;
  walk(node, (child) => {
    if (isDocumentGlobalTarget(child)) found = true;
  });
  return found;
}

function inspectJavaScript(source, sourceType = 'module') {
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType,
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true
  });
  let observerCount = 0;
  let hasForbiddenTarget = false;

  walk(ast, (node) => {
    if (node.type === 'NewExpression') {
      const calleeName = node.callee.type === 'Identifier'
        ? node.callee.name
        : memberName(node.callee);
      if (calleeName === 'MutationObserver') observerCount += 1;
    }

    if (node.type === 'CallExpression' && memberName(node.callee) === 'observe' && node.arguments[0]) {
      if (containsDocumentGlobalTarget(node.arguments[0])) hasForbiddenTarget = true;
    }
  });

  return { observerCount, hasForbiddenTarget };
}

function scanDir(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...scanDir(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

function runAudit() {
  const files = scanDir(APP_DIR);
  const errors = [];
  let observedTotal = 0;

  if (fs.existsSync(HTML_PATH)) {
    const html = fs.readFileSync(HTML_PATH, 'utf8');
    for (const script of extractInlineScripts(html)) {
      const location = `public/index.html inline script #${script.index}` +
        (script.id ? ` (id="${script.id}")` : '') + `, line ${script.line}`;
      let result;
      try {
        result = inspectJavaScript(script.content, script.sourceType);
      } catch (error) {
        errors.push(`❌ ${location}: не удалось разобрать JavaScript (${error.message}).`);
        continue;
      }
      if (result.hasForbiddenTarget) {
        errors.push(`❌ ${location}: запрещённый global observer target (document.body/document.documentElement).`);
      }
      if (result.observerCount > 0) {
        errors.push(`❌ ${location}: найдено ${result.observerCount} MutationObserver; inline bootstrap не имеет component lifecycle и не может создавать observers.`);
      }
    }
  }

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    let result;
    try {
      result = inspectJavaScript(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`❌ ${relPath}: не удалось разобрать JavaScript (${error.message}).`);
      continue;
    }
    observedTotal += result.observerCount;
    if (result.hasForbiddenTarget) {
      errors.push(`❌ ${relPath}: обнаружен запрещённый таргетинг на document.body/document.documentElement!`);
    }
    const allowed = ALLOWLIST[relPath] || 0;
    if (result.observerCount > allowed) {
      errors.push(`❌ ${relPath}: найдено ${result.observerCount} MutationObserver (лимит по ADR-008: ${allowed}).`);
    }
  }

  // Реестр не должен сохранять разрешение на уже удалённый observer.
  for (const [relPath, allowed] of Object.entries(ALLOWLIST)) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const { observerCount } = inspectJavaScript(fs.readFileSync(fullPath, 'utf8'));
      if (observerCount < allowed) {
        errors.push(`⚠️ ${relPath}: квота ${allowed}, но обнаружено всего ${observerCount}. Уменьшите значение в ALLOWLIST.`);
      }
    } catch (error) {
      errors.push(`❌ ${relPath}: не удалось проверить квоту (${error.message}).`);
    }
  }

  if (errors.length > 0) {
    console.error('\n💥 Нарушения правил реактивности DOM (ADR-008):');
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  console.log(`✅ MutationObserver: цели изолированы, квота соблюдена (${observedTotal}/5 экземпляров)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runAudit();
