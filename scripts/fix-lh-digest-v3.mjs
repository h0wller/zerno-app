#!/usr/bin/env node
/** * scripts/fix-lh-digest-v3.mjs — Дайджест отчётов Lighthouse v13+ * Корректно читает layout-shifts, вложенные причины cls-culprits и сдвиги. */

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
if (!ROOT) { console.error('\u2717 Не найден корень проекта'); process.exit(1); }

const C = { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', m: '\x1b[35m', d: '\x1b[2m', rst: '\x1b[0m' };
const h = (t) => console.log(`\n${C.m}\u2550\u2550 ${t} ${'\u2550'.repeat(Math.max(0, 60 - t.length))}${C.rst}`);
const kv = (k, v) => console.log(`  ${C.c}${k}:${C.rst} ${v}`);
const warn = (msg) => console.log(`  ${C.y}\u26a0 ${msg}${C.rst}`);

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
    /^localhost_3000-.*\.json$/i,
    /^lh-cold-.*\.json$/i,
    /^lighthouse-.*\.json$/i,
    /^lh-.*\.json$/i
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
    console.error(`\n${C.r}\u2717${C.rst} Lighthouse JSON-отчёт не найден автоматически.`);
    console.error(`Укажи путь аргументом: node scripts/fix-lh-digest-v3.mjs path/to/report.json`);
    process.exit(1);
  }
  console.log(`${C.g}\u2713${C.rst} Выбран отчёт: ${best.name}`);
  return best.p;
}

function formatThrottling(th) {
  if (!th) return 'n/a';
  const parts = [];
  if (th.rttMs != null) parts.push(`rtt=${th.rttMs}ms`);
  if (th.throughputKbps != null) parts.push(`tp=${Math.round(th.throughputKbps / 1000)}mbps`);
  if (th.cpuSlowdownMultiplier != null) parts.push(`cpu=${th.cpuSlowdownMultiplier}x`);
  if (th.requestLatencyMs != null) parts.push(`lat=${th.requestLatencyMs}ms`);
  if (th.downloadThroughputKbps != null) parts.push(`dl=${Math.round(th.downloadThroughputKbps / 1000)}mbps`);
  if (th.uploadThroughputKbps != null) parts.push(`ul=${Math.round(th.uploadThroughputKbps / 1000)}mbps`);
  return parts.length ? parts.join(' ') : 'custom';
}

function formatBundleSize(size) {
  if (!size) return 'n/a';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(0)}KiB`;
  return `${size}B`;
}

function checkAnomalies(J, A) {
  const anomalies = [];
  const config = J.configSettings || {};
  const throttling = config.throttling || {};
  const throttlingMethod = config.throttlingMethod || 'n/a';
  const gatherMode = J.gatherMode || 'n/a';

  // Check if throttling is simulated or real device
  if (throttlingMethod === 'simulate' && throttling.cpuSlowdownMultiplier === 1 && throttling.rttMs === 0 && throttling.throughputKbps === Infinity) {
    anomalies.push('no throttling applied (cpu=1x, rtt=0, tp=Infinity)');
  }

  // Check LCP phases sum vs actual LCP
  const lcpBreakdown = A['lcp-breakdown-insight'];
  const lcpAudit = A['largest-contentful-paint'];
  if (lcpBreakdown?.details?.items && lcpAudit?.numericValue) {
    const tableItem = lcpBreakdown.details.items.find(x => x.type === 'table');
    if (tableItem?.items) {
      const sum = tableItem.items.reduce((acc, it) => acc + (it.duration || 0), 0);
      const lcpValue = lcpAudit.numericValue;
      const diff = Math.abs(sum - lcpValue);
      if (diff > 100) {
        anomalies.push(`LCP phases sum (${Math.round(sum)}ms) != LCP (${Math.round(lcpValue)}ms), diff=${Math.round(diff)}ms`);
      }
    }
  }

  // Check if LCP node is missing
  if (lcpBreakdown?.details?.items) {
    const nodeItem = lcpBreakdown.details.items.find(x => x.type === 'node');
    if (!nodeItem?.nodeLabel && !nodeItem?.snippet) {
      anomalies.push('LCP node missing from breakdown');
    }
  }

  // Check if long tasks is empty but main bundle exists
  const lt = A['long-tasks'];
  let hasLargeBundle = false;

  const networkRequests = A['network-requests']?.details?.items || [];
  const mainBundleRequest = networkRequests.find(r => r.url && r.url.includes('main.bundle'));
  if (mainBundleRequest && (mainBundleRequest.transferSize || mainBundleRequest.resourceSize || 0) > 50000) {
    hasLargeBundle = true;
  }

  const mainBundleMt = A['mainthread-work-breakdown']?.details?.items?.find(it =>
    it.group && it.group.includes('main.bundle') || it.url && it.url.includes('main.bundle')
  );
  if (mainBundleMt && (mainBundleMt.totalBytes || mainBundleMt.duration || 0) > 50000) {
    hasLargeBundle = true;
  }

  if (!hasLargeBundle) {
    const largeScripts = networkRequests.filter(r =>
      r.url && (r.url.includes('.js') || r.url.includes('bundle')) &&
      (r.transferSize || r.resourceSize || 0) > 50000
    );
    if (largeScripts.length > 0) {
      hasLargeBundle = true;
    }
  }

  if (hasLargeBundle && (!lt?.details?.items || lt.details.items.length === 0)) {
    anomalies.push('long-tasks is empty but large JS bundle detected - possible missing trace');
  }

  // Check for warm cache
  if (gatherMode === 'navigation') {
    const fcp = A.metrics?.details?.items?.[0]?.firstContentfulPaint;
    const lcp = A.metrics?.details?.items?.[0]?.largestContentfulPaint;
    if (fcp && lcp && fcp < 800 && lcp < 1500) {
      anomalies.push(`suspiciously fast FCP (${Math.round(fcp)}ms) and LCP (${Math.round(lcp)}ms) - likely warm cache`);
    }
  }

  // Check CLS score > 0.1 with multiple large shifts
  const layoutShifts = A['layout-shifts'];
  if (layoutShifts?.details?.items) {
    const maxShift = Math.max(...layoutShifts.details.items.map(it => it.score || 0));
    const clsMetric = A.metrics?.details?.items?.[0]?.cumulativeLayoutShift || 0;
    if (maxShift > 0.1 && clsMetric > 0.1) {
      const largeShifts = layoutShifts.details.items.filter(it => (it.score || 0) > 0.05);
      if (largeShifts.length >= 2) {
        anomalies.push(`multiple large layout shifts (${largeShifts.length} shifts > 0.05, max=${maxShift.toFixed(3)})`);
      }
    }
  }

  // Check render-blocking CSS + unused CSS
  const renderBlocking = A['render-blocking-insight'] || A['render-blocking-resources'];
  const unusedCss = A['unused-css-rules'];
  if (renderBlocking?.details?.items?.length && unusedCss?.details?.items?.length) {
    const rbTotal = renderBlocking.details.items.reduce((acc, it) => acc + (it.wastedMs || it.duration || 0), 0);
    const unusedTotal = unusedCss.details.items.reduce((acc, it) => acc + (it.wastedBytes || 0), 0);
    if (rbTotal > 200 && unusedTotal > 10000) {
      anomalies.push(`render-blocking CSS (${Math.round(rbTotal)}ms) + unused CSS (${Math.round(unusedTotal/1024)}KiB) - optimize critical path`);
    }
  }

  return anomalies;
}

(async () => {
  const reportPath = pickReport();
  kv('путь', reportPath);

  const J = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const A = J.audits || {};

  // CONTEXT / SETTINGS
  h('CONTEXT / SETTINGS');
  kv('finalDisplayedUrl', J.finalDisplayedUrl || J.finalUrl || 'n/a');

  const config = J.configSettings || {};
  const formFactor = config.formFactor || J.settings?.formFactor || 'n/a';
  kv('formFactor', formFactor);

  const throttling = config.throttling || {};
  const throttlingMethod = config.throttlingMethod || J.settings?.throttlingMethod || 'n/a';
  kv('throttlingMethod', throttlingMethod);
  kv('throttling', formatThrottling(throttling));

  const gatherMode = J.gatherMode || 'n/a';
  kv('gatherMode', gatherMode);

  const swAudit = A['service-worker'];
  const swStatus = swAudit?.scoreDisplayMode || (swAudit?.score === 1 ? 'active' : 'inactive');
  kv('serviceWorker', swStatus);

  const cacheInfo = J.fetchTime ? `fetchTime=${J.fetchTime}ms` : '';
  if (cacheInfo) kv('fetchTime', cacheInfo);

  const anomalies = checkAnomalies(J, A);
  if (anomalies.length > 0) {
    h('ANOMALIES / WARNINGS');
    anomalies.forEach(a => warn(a));
  }

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
        console.log(`    ${C.c}${it.label || it.subpart}:${C.rst} ${Math.round(it.duration)}ms`);
      });
    }
    const nodeItem = lcpBreakdown.details.items.find(x => x.type === 'node');
    if (nodeItem?.nodeLabel || nodeItem?.snippet) {
      console.log(`    ${C.g}node:${C.rst} ${nodeItem.snippet || nodeItem.nodeLabel}`);
    } else if (nodeItem) {
      console.log(`    ${C.y}node:${C.rst} (missing)`);
    }
  }

  h('CLS: виновники сдвигов (Lighthouse v13)');
  const layoutShifts = A['layout-shifts'];
  const shiftItems = layoutShifts?.details?.items || [];
  if (shiftItems.length) {
    shiftItems.forEach((it, idx) => {
      const score = (it.score || 0).toFixed(4);
      const sel = it.node?.selector || 'unknown';
      const snip = String(it.node?.snippet || it.node?.nodeLabel || '').replace(/\s+/g, ' ').slice(0, 100);
      console.log(`  ${C.r}#${idx + 1} score=${score}${C.rst} ${C.g}${sel}${C.rst}`);
      if (snip) console.log(`     ${C.d}${snip}${C.rst}`);
      if (it.subItems?.items) {
        it.subItems.items.forEach(cause => {
          console.log(`     ${C.y}\u21b3 причина:${C.rst} ${cause.cause || ''} ${C.d}(${cause.extra?.value || ''})${C.rst}`);
        });
      }
    });
  } else {
    kv('layout-shifts', '\u043d\u0435\u0442 \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u0441\u0434\u0432\u0438\u0433\u043e\u0432');
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
        console.log(`  ${C.y}${Math.round(t.duration)}ms${C.rst} @${Math.round(t.startTime || 0)}ms ${script}`);
      });
  } else {
    kv('long-tasks', '\u043d\u0435\u0442');
  }

  h('RENDER-BLOCKING / UNUSED CSS');
  for (const id of ['render-blocking-insight', 'render-blocking-resources', 'unused-css-rules']) {
    const a = A[id];
    if (!a?.details?.items?.length) continue;
    console.log(`  ${C.y}${id}${C.rst} (${a.displayValue || ''})`);
    a.details.items.slice(0, 5).forEach((it) => {
      const url = (it.url || '').replace('http://localhost:3000', '');
      const wasted = Math.round(it.wastedMs || it.duration || 0);
      const kb = Math.round((it.wastedBytes || it.totalBytes || 0) / 1024);
      console.log(`    ${C.d}${wasted}ms ${kb}KiB${C.rst} ${url}`);
    });
  }

  // IMAGE DELIVERY
  const imageAudit = A['image-delivery-insight'];
  if (imageAudit?.details?.items?.length) {
    h('IMAGE DELIVERY (wasted bytes)');
    const totalWasted = imageAudit.details.items.reduce((acc, it) => acc + (it.wastedBytes || 0), 0);
    console.log(`  ${C.y}Total wasted: ${formatBundleSize(totalWasted)}${C.rst}`);
    imageAudit.details.items.slice(0, 5).forEach((it) => {
      const url = (it.url || '').split('/').pop();
      const wasted = it.wastedBytes || 0;
      const total = it.totalBytes || 0;
      const ratio = total > 0 ? ((wasted / total) * 100).toFixed(0) : 0;
      console.log(`    ${C.d}${formatBundleSize(wasted)} wasted (${ratio}%)${C.rst} ${url}`);
    });
  }

  console.log(`\n${C.g}\u2713 Анализ отчёта завершён${C.rst}`);
})().catch((e) => {
  console.error('\n\ud83d\udca5 Ошибка анализа:', e);
  process.exit(1);
});