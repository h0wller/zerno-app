#!/usr/bin/env node
/**
 * scripts/perf-p1-lazy-modules.mjs
 * PERF-P1 v1: безопасный ролевой лоадер не-гостевых модулей.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const changed = [], warnings = [];

const resolvePath = (p) => path.join(root, p);
function backupFile(abs) {
  if (!fs.existsSync(abs)) return null;
  let c = abs + '.bak-' + stamp, i = 1;
  while (fs.existsSync(c)) c = abs + '.bak-' + stamp + '-' + (i++);
  fs.copyFileSync(abs, c); return c;
}
function readLf(abs) {
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { text: raw.replace(/\r\n/g, '\n'), eol };
}
function writeEol(abs, text, eol) {
  fs.writeFileSync(abs, eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}
function checkSyntax(abs) {
  const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('node --check failed: ' + abs + '\n' + (r.stderr || r.stdout));
}
function modifyFile(rel, fn) {
  const abs = resolvePath(rel);
  if (!fs.existsSync(abs)) { warnings.push('Файл не найден: ' + rel); return false; }
  const { text, eol } = readLf(abs);
  const out = fn(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(abs);
  writeEol(abs, out, eol);
  if (rel.endsWith('.js') || rel.endsWith('.mjs')) {
    try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  }
  changed.push(rel);
  console.log('✔ Изменён: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
  return true;
}
function patchSwCache(text) {
  let found = false;
  const out = text.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, function (m, pre, val, q) {
    found = true;
    const next = /\d/.test(val) ? val.replace(/(\d+)(?=[^\d]*$)/, function (_, n) { return String(Number(n) + 1); }) : val + '-2';
    console.log('   STATIC_CACHE: ' + val + ' -> ' + next);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден');
  return found ? out : text;
}

/* ═══ 1. Список ленивых модулей (с выверенными путями) ═══ */
const LAZY_MODULES = [
  { path: '/app/core/editor.js', name: 'editor', roles: ['admin'], trigger: '#emModal, #openEditorBtn, [data-modal="emModal"]' },
  { path: '/app/admin-extra.js', name: 'adminExtra', roles: ['admin'] },
  { path: '/app/ui/cashier-log.js', name: 'cashierLog', roles: ['cashier'] },
  { path: '/app/core/dash.js', name: 'dash', trigger: '#dashToggle, #dashBtn, [data-modal="dashModal"]' },
  { path: '/app/core/promo.js', name: 'promo', trigger: '#promoToggle, #promoBtn, [data-modal="promoModal"]' },
  { path: '/app/core/staffpin.js', name: 'staffpin', trigger: '#setPinBtn, #pinBtn, #staffPinBtn, [data-modal="pinModal"]' },
  { path: '/app/scanner.js', name: 'scanner', trigger: '#scanFab, #scanBtn, [data-action="scan"]' }
];

/* ═══ 2. Ролевой лоадер с replay первого клика и надежной детекцией роли ═══ */
const LAZY_LOADER_JS = `
/* PERF-P1 v1: ролевой лоадер не-гостевых модулей */
(function () {
  var modules = window.__ztLazyModules || ${JSON.stringify(LAZY_MODULES)};
  var inflight = {};
  var loaded = {};

  function loadModule(url) {
    if (loaded[url]) return Promise.resolve();
    if (inflight[url]) return inflight[url];
    var p = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = false; // Сохраняем строгий порядок выполнения зависимых скриптов
      var timer = setTimeout(function () {
        delete inflight[url];
        reject(new Error('Lazy module timeout: ' + url));
      }, 5000);
      s.onload = function () {
        clearTimeout(timer);
        loaded[url] = true;
        delete inflight[url];
        resolve();
      };
      s.onerror = function () {
        clearTimeout(timer);
        delete inflight[url];
        reject(new Error('Lazy module failed: ' + url));
      };
      document.head.appendChild(s);
    });
    inflight[url] = p;
    return p;
  }

  function loadModulesByRole(role) {
    if (!role) return Promise.resolve();
    var targets = modules.filter(function (m) {
      return m.roles && m.roles.indexOf(role) !== -1;
    });
    if (!targets.length) return Promise.resolve();
    return Promise.all(targets.map(function (m) { return loadModule(m.path); })).catch(function (e) {
      if (window.toast) window.toast('Ошибка загрузки компонентов персонала', '⚠️');
    });
  }

  function bindTrigger(selector, url) {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest(selector);
      if (!btn) return;
      if (loaded[url]) return; // Модуль уже на месте, клик идет штатно

      // Останавливаем пустой клик до загрузки скрипта
      e.preventDefault();
      e.stopImmediatePropagation();

      loadModule(url).then(function () {
        // Воспроизводим клик с уже зарегистрированным обработчиком
        btn.click();
      }).catch(function () {
        if (window.toast) window.toast('Не удалось загрузить модуль', '⚠️');
      });
    }, true);
  }

  function detectRole() {
    try {
      var r = localStorage.getItem('zt_role');
      if (r) return r;
      var u = JSON.parse(localStorage.getItem('zt_user') || '{}');
      if (u && u.role) return u.role;
      var p = JSON.parse(localStorage.getItem('zt_profile') || '{}');
      if (p && p.role) return p.role;
    } catch (e) {}
    return '';
  }

  /* Ранняя загрузка, если роль сохранена в сессии */
  var currentRole = detectRole();
  if (currentRole === 'admin' || currentRole === 'cashier') {
    loadModulesByRole(currentRole);
  }

  /* Регистрация клик-триггеров */
  modules.forEach(function (m) {
    if (m.trigger) bindTrigger(m.trigger, m.path);
  });

  /* Слушатель динамического переключения режимов */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#modeSeg button[data-mode], [data-set-mode]');
    if (!btn) return;
    var mode = btn.getAttribute('data-mode') || btn.getAttribute('data-set-mode');
    if (mode === 'admin' || mode === 'cashier') {
      loadModulesByRole(mode);
    }
  }, true);

  window.__ztLazyLoad = {
    loadModule: loadModule,
    loadModulesByRole: loadModulesByRole,
    loaded: loaded
  };
})();
`;

/* ═══ 3. Патчеры файлов ═══ */
function patchIndexHtml(text) {
  if (text.indexOf('PERF-P1 v1') !== -1) return text;

  let out = text;
  let removedCount = 0;

  LAZY_MODULES.forEach(function (m) {
    const escaped = m.path.replace(/\//g, '\\/').replace(/\./g, '\\.');
    const re = new RegExp('<script[^>]*src=["\']' + escaped + '["\'][^>]*>\\s*<\\/script>\\s*\\n?', 'g');
    if (re.test(out)) {
      out = out.replace(re, '');
      removedCount++;
    }
  });

  console.log('   Удалено тегов скриптов из index.html: ' + removedCount);

  const listInline = '<script>/* PERF-P1 v1: список ленивых модулей */\nwindow.__ztLazyModules = ' + JSON.stringify(LAZY_MODULES, null, 2) + ';\n</script>\n';
  
  // Вставляем список перед первым скриптом приложения в head или перед </body>
  const scriptMatch = out.match(/<script[^>]*src=["'][^"']*app\//);
  if (scriptMatch) {
    const idx = scriptMatch.index;
    out = out.slice(0, idx) + listInline + out.slice(idx);
  } else {
    out = out.replace('</head>', listInline + '</head>');
  }

  return out;
}

function patchBoot(text) {
  if (text.indexOf('PERF-P1 v1') !== -1) return text;
  return text.trimEnd() + '\n' + LAZY_LOADER_JS;
}

/* ═══ Main ═══ */
try {
  console.log('Task: PERF-P1 v1 (ролевой лоадер не-гостевых модулей)...\n');

  modifyFile('public/index.html', patchIndexHtml);
  modifyFile('public/app/core/boot.js', patchBoot);
  modifyFile('public/sw.js', patchSwCache);

  if (warnings.length) {
    console.warn('\nПредупреждения:');
    warnings.forEach((w) => console.warn(' - ' + w));
  }
  if (changed.length) {
    console.log('\nИзменённые файлы:');
    changed.forEach((f) => console.log(' - ' + f));
  }
  console.log('\nГотово к тестированию.\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:', err);
  process.exit(1);
}