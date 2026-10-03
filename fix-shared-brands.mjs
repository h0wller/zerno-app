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

const C = {
  g: '\x1b[32m',
  y: '\x1b[33m',
  c: '\x1b[36m',
  r: '\x1b[31m',
  rst: '\x1b[0m'
};

async function patchThemeCss() {
  const cssPath = path.join(ROOT, 'public', 'app', 'ui', 'theme-v2.css');
  let content = await fs.readFile(cssPath, 'utf8');

  if (content.includes('CLS-FIX: Базовый мобильный макет .wrap и .panel')) {
    console.log(`${C.y}ℹ theme-v2.css уже содержит CLS-фикс${C.rst}`);
    return;
  }

  const cssPatch = `
/* ── CLS-FIX: Базовый мобильный макет .wrap и .panel (защита от FOUC на мобильных) ── */
@media (max-width: 820px) {
  .wrap {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px;
    padding: 8px 10px 28px 6px;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 120;
    width: min(400px, 100%);
    max-height: none;
    border-radius: 22px 0 0 22px;
    transform: translateX(105%);
    transition: transform 0.35s cubic-bezier(0.2, 1, 0.3, 1);
    padding-top: calc(env(safe-area-inset-top, 0px) + 6px);
  }
  .panel.open {
    transform: none;
  }
}
`;

  content = content.trimEnd() + '\n' + cssPatch;
  await fs.writeFile(cssPath, content, 'utf8');
  console.log(`${C.g}✓ theme-v2.css обновлён (мобильные стили .panel и .wrap внесены в Слой 1)${C.rst}`);
}

async function bumpSw() {
  const swPath = path.join(ROOT, 'public', 'sw.js');
  let content = await fs.readFile(swPath, 'utf8');

  const match = content.match(/zerno-static-v(\d+)/);
  if (!match) {
    console.log(`${C.y}⚠ Паттерн zerno-static-vNNN не найден в sw.js${C.rst}`);
    return;
  }

  const curVer = parseInt(match[1], 10);
  const nextVer = curVer + 1;
  content = content.replace(`zerno-static-v${curVer}`, `zerno-static-v${nextVer}`);

  await fs.writeFile(swPath, content, 'utf8');
  console.log(`${C.g}✓ sw.js обновлён: zerno-static-v${curVer} → zerno-static-v${nextVer}${C.rst}`);
}

async function createDigestV3() {
  const digestPath = path.join(ROOT, 'scripts', 'fix-lh-digest-v3.mjs');
  const code = `#!/usr/bin/env node
/**
 * scripts/fix-lh-digest-v3.mjs — Дайджест отчетов Lighthouse v13+
 * Корректно читает layout-shifts, вложенные таблицы cls-culprits и причины сдвигов.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function findRoot() {
  const candidates = [path.resolve(__dirname, '..'), __dirname, process.cwd(), path.resolve(process.cwd(), '..')];
  for (const c of candidates) if (fsSync.existsSync(path.join(c, 'public', 'index.html'))) return c;
  return null;
}
const ROOT = findRoot();
if (!ROOT) { console.error('✗ Не найден корень проекта'); process.exit(1); }

const C = { g: '\\x1b[32m', y: '\\x1b[33m', r: '\\x1b[31m', c: '\\x1b[36m', m: '\\x1b[35m', d: '\\x1b[2m', rst: '\\x1b[0m' };
const h = (t) => console.log(\`\\n\${C.m}══ \${t} \${'═'.repeat(Math.max(0, 60 - t.length))}\${C.rst}\`);
const kv = (k, v) => console.log(\`  \${C.c}\${k}:\${C.rst} \${v}\`);

function pickReport() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);

  const searchDirs = [
    ROOT,
    process.cwd(),
    path.resolve(__dirname, '..'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Documents')
  ];

  const patterns = [
    /^localhost_3000-.*\\.json$/i,
    /^lh-cold-.*\\.json$/i,
    /^lighthouse-.*\\.json$/i,
    /^lh-.*\\.json$/i
  ];

  let best = null;
  for (const dir of searchDirs) {
    if (!fsSync.existsSync(dir)) continue;
    try {
      for (const f of fsSync.readdirSync(dir)) {
        if (!patterns.some(p => p.test(f))) continue;
        const p = path.join(dir, f);
        const mt = fsSync.statSync(p).mtimeMs;
        if (!best || mt > best.mt) best = { p, mt, name: f };
      }
    } catch (_) {}
  }

  if (!best) {
    console.error(\`\\n\${C.r}✗\${C.rst} Lighthouse JSON-отчёт не найден автоматически.\`);
    console.error(\`Укажи путь аргументом: node scripts/fix-lh-digest-v3.mjs path/to/report.json\`);
    process.exit(1);
  }

  console.log(\`\${C.g}✓\${C.rst} Выбран отчёт: \${best.name}\`);
  return best.p;
}

(async () => {
  const reportPath = pickReport();
  kv('путь', reportPath);
  const J = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const A = J.audits || {};

  h('SCORE / METRICS');
  kv('performance', J.categories?.performance ? J.categories.performance.score : 'n/a');
  const m = A.metrics?.details?.items?.[0];
  if (m) {
    for (const k of ['firstContentfulPaint', 'largestContentfulPaint', 'totalBlockingTime', 'cumulativeLayoutShift', 'speedIndex']) {
      if (m[k] != null) kv(k, Math.round(m[k] * 1000) / 1000);
    }
  }

  h('LCP: элемент и сабпарты');
  const lcpAudit = A['largest-contentful-paint'];
  if (lcpAudit) kv('LCP displayValue', lcpAudit.displayValue || lcpAudit.numericValue);

  const lcpBreakdown = A['lcp-breakdown-insight'];
  if (lcpBreakdown?.details?.items) {
    const tableItem = lcpBreakdown.details.items.find(x => x.type === 'table');
    if (tableItem?.items) {
      tableItem.items.forEach(it => {
        console.log(\`    \${C.c}\${it.label || it.subpart}:\${C.rst} \${Math.round(it.duration)}ms\`);
      });
    }
    const nodeItem = lcpBreakdown.details.items.find(x => x.type === 'node');
    if (nodeItem?.nodeLabel || nodeItem?.snippet) {
      console.log(\`    \${C.g}node:\${C.rst} \${nodeItem.snippet || nodeItem.nodeLabel}\`);
    }
  }

  h('CLS: виновники сдвигов (Lighthouse v13)');
  const layoutShifts = A['layout-shifts'];
  const shiftItems = layoutShifts?.details?.items || [];
  if (shiftItems.length) {
    shiftItems.forEach((it, idx) => {
      const score = (it.score || 0).toFixed(4);
      const sel = it.node?.selector || 'unknown';
      const snip = String(it.node?.snippet || it.node?.nodeLabel || '').replace(/\\s+/g, ' ').slice(0, 100);
      console.log(\`  \${C.r}#\${idx + 1} score=\${score}\${C.rst} \${C.g}\${sel}\${C.rst}\`);
      if (snip) console.log(\`     \${C.d}\${snip}\${C.rst}\`);
      if (it.subItems?.items) {
        it.subItems.items.forEach(cause => {
          console.log(\`     \${C.y}↳ причина:\${C.rst} \${cause.cause || ''} \${C.d}(\${cause.extra?.value || ''})\${C.rst}\`);
        });
      }
    });
  } else {
    kv('layout-shifts', 'нет зафиксированных сдвигов');
  }

  h('LONG TASKS (top 10)');
  const lt = A['long-tasks'];
  if (lt?.details?.items) {
    lt.details.items
      .slice()
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .forEach((t) => {
        const script = (t.url || '(inline)').split('/').slice(-2).join('/');
        console.log(\`  \${C.y}\${Math.round(t.duration)}ms\${C.rst} @\${Math.round(t.startTime || 0)}ms \${script}\`);
      });
  } else {
    kv('long-tasks', 'нет');
  }

  h('RENDER-BLOCKING / UNUSED CSS');
  for (const id of ['render-blocking-insight', 'render-blocking-resources', 'unused-css-rules']) {
    const a = A[id];
    if (!a?.details?.items?.length) continue;
    console.log(\`  \${C.y}\${id}\${C.rst} (\${a.displayValue || ''})\`);
    a.details.items.slice(0, 5).forEach((it) => {
      const url = (it.url || '').replace('http://localhost:3000', '');
      const wasted = Math.round(it.wastedMs || it.duration || 0);
      const kb = Math.round((it.wastedBytes || it.totalBytes || 0) / 1024);
      console.log(\`    \${C.d}\${wasted}ms \${kb}KiB\${C.rst} \${url}\`);
    });
  }

  console.log(\`\\n\${C.g}✓ Анализ отчёта завершён\${C.rst}\`);
})().catch((e) => {
  console.error('\\n💥 Ошибка анализа:', e);
  process.exit(1);
});
`;

  await fs.writeFile(digestPath, code, 'utf8');
  console.log(`${C.g}✓ Скрипт scripts/fix-lh-digest-v3.mjs успешно создан${C.rst}`);
}

(async () => {
  console.log(`\n${C.c}══ Внедрение фикса CLS и генерация дайджеста v3 ══${C.rst}\n`);
  await patchThemeCss();
  await bumpSw();
  await createDigestV3();
  console.log(`\n${C.g}🎉 Все шаги выполнены успешно!${C.rst}\n`);
})();