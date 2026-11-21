#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { installHtmlVariantRoute } from './patch-html.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? '1'];
}));
const urls = {
  A: args['url-a'],
  F: args['url-f'],
  C8: args['url-a'],
};
const runs = Number(args.runs || 5);
const delays = (args.delays || '0,3000').split(',').map(Number);
const brands = (args.brands || 'coffee,delivery').split(',');
const outputDir = path.resolve(args.out || 'perf-exp-results');
const traceSamples = args['trace-samples'] === '1';
const network = { latency: 150, throughputBytesPerSecond: 1638.4 * 1024 / 8 };
const apiPaths = new Set(['/api/menu', '/api/dmenu']);

if (!urls.A || !urls.F || delays.some((delay) => ![0, 3000].includes(delay)) ||
    brands.some((brand) => !['coffee', 'delivery'].includes(brand))) {
  throw new Error('Expected --url-a, --url-f, --runs, --delays=0,3000, --brands=coffee,delivery');
}
fs.mkdirSync(outputDir, { recursive: true });

function percentile(values, quantile) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * quantile;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}
function stats(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return {
    median: percentile(valid, 0.5),
    min: Math.min(...valid),
    max: Math.max(...valid),
    n: valid.length,
  };
}
function pathsFromItem(item, origin) {
  const urls = [item.img, ...String(item.imgSrcset || '').split(',').map((part) => part.trim().split(/\s+/)[0])]
    .filter(Boolean)
    .map((url) => new URL(url, origin).pathname);
  return [...new Set(urls)];
}
function requestType(pathname) {
  if (apiPaths.has(pathname)) return 'api';
  if (pathname.startsWith('/media/dishes/')) return 'image';
  return null;
}

async function installProbe(context, page, brand) {
  await context.addInitScript((savedBrand) => {
    try {
      localStorage.setItem('zt_brand', savedBrand);
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    } catch (_) {}
    document.addEventListener('click', (event) => {
      const choice = event.target && event.target.closest ? event.target.closest('[data-go]') : null;
      if (choice && (choice.dataset.go === 'coffee' || choice.dataset.go === 'delivery')) {
        window.__perfExpTap = performance.timeOrigin + performance.now();
        window.__perfExpTappedBrand = choice.dataset.go;
      }
    }, true);
  }, brand);
}

async function startTrace(cdp) {
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,v8,blink.user_timing,loading,disabled-by-default-devtools.timeline',
    transferMode: 'ReturnAsStream',
  });
}
async function finishTrace(cdp, tapAt, cardAt, clockOffsetMs, filePath) {
  const complete = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tracing.tracingComplete timed out')), 30000);
    cdp.once('Tracing.tracingComplete', (event) => {
      clearTimeout(timeout);
      resolve(event);
    });
  });
  await cdp.send('Tracing.end');
  const event = await complete;
  let raw = '';
  if (event.stream) {
    while (true) {
      const chunk = await cdp.send('IO.read', { handle: event.stream, size: 1024 * 1024 });
      raw += chunk.data || '';
      if (chunk.eof) break;
    }
    await cdp.send('IO.close', { handle: event.stream }).catch(() => {});
  }
  const parsed = raw ? JSON.parse(raw) : { traceEvents: [] };
  const selected = (parsed.traceEvents || []).filter((entry) => {
    if (!Number.isFinite(entry.ts) || !Number.isFinite(entry.dur)) return false;
    const start = entry.ts / 1000 + clockOffsetMs;
    const end = start + entry.dur / 1000;
    return end >= tapAt && start <= cardAt;
  });
  const names = ['RunTask', 'EvaluateScript', 'FunctionCall', 'EventDispatch', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint'];
  const breakdown = {};
  for (const name of names) {
    const matches = selected.filter((entry) => entry.name === name && entry.ph === 'X');
    breakdown[name] = {
      count: matches.length,
      totalMs: matches.reduce((sum, entry) => sum + entry.dur / 1000, 0),
      maxMs: matches.length ? Math.max(...matches.map((entry) => entry.dur / 1000)) : 0,
    };
  }
  const longTasks = selected
    .filter((entry) => entry.name === 'RunTask' && entry.ph === 'X' && entry.dur >= 50000)
    .map((entry) => ({ startMs: entry.ts / 1000 + clockOffsetMs - tapAt, durationMs: entry.dur / 1000 }));
  fs.writeFileSync(filePath, JSON.stringify({ traceEvents: parsed.traceEvents || [] }));
  return { breakdown, longTasks, traceFile: path.basename(filePath) };
}

async function runOnce(browser, variant, brand, delayMs, runNumber, captureTrace = false) {
  const baseUrl = urls[variant];
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const row = {
    variant, brand, delayMs, run: runNumber,
    requests: [], console: [], targetPaths: [],
    clickAt: null, clickToCardMs: null, failedRuns: 0,
  };
  const requestById = new Map();
  let targetPaths = [];
  let clockOffsetMs = null;
  let cdp;
  let tracing = false;
  try {
    const page = await context.newPage();
    await installProbe(context, page, brand);
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) row.console.push({ type: message.type(), text: message.text() });
    });
    page.on('pageerror', (error) => row.console.push({ type: 'pageerror', text: error.message }));

    if (variant !== 'A' && variant !== 'F') await installHtmlVariantRoute(page, variant);

    page.on('response', async (response) => {
      try {
        const pathname = new URL(response.url()).pathname;
        if (pathname !== (brand === 'delivery' ? '/api/dmenu' : '/api/menu') || !response.ok()) return;
        const payload = await response.json();
        const initialCategory = brand === 'delivery' ? 'pizza' : 'coffee';
        const first = (payload.items || []).find((item) => item && item.on && item.img && item.cat === initialCategory);
        if (first) {
          targetPaths = pathsFromItem(first, baseUrl);
          row.targetPaths = targetPaths;
          row.firstItem = { id: first.id, name: first.name, img: first.img, imgSrcset: first.imgSrcset || null };
        }
      } catch (error) {
        row.console.push({ type: 'json-probe-error', text: error.message });
      }
    });

    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: network.latency,
      downloadThroughput: network.throughputBytesPerSecond,
      uploadThroughput: network.throughputBytesPerSecond,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    cdp.on('Network.requestWillBeSent', (event) => {
      const pathname = new URL(event.request.url).pathname;
      const type = requestType(pathname);
      if (!type) return;
      const wallTime = Number.isFinite(event.wallTime) ? event.wallTime * 1000 : Date.now();
      const offset = wallTime - event.timestamp * 1000;
      if (clockOffsetMs === null) clockOffsetMs = offset;
      const record = {
        requestId: event.requestId, type, pathname, url: event.request.url,
        startedAt: wallTime, responseAt: null, finishedAt: null,
        status: null, encodedDataLength: 0, dataChunks: [], failed: false, errorText: null,
      };
      requestById.set(event.requestId, record);
      row.requests.push(record);
    });
    cdp.on('Network.responseReceived', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.responseAt = event.timestamp * 1000 + clockOffsetMs;
      record.status = event.response.status;
      record.mimeType = event.response.mimeType;
    });
    cdp.on('Network.dataReceived', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.dataChunks.push({
        at: event.timestamp * 1000 + clockOffsetMs,
        encodedDataLength: event.encodedDataLength || 0,
      });
    });
    cdp.on('Network.loadingFinished', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.finishedAt = event.timestamp * 1000 + clockOffsetMs;
      record.encodedDataLength = event.encodedDataLength || 0;
    });
    cdp.on('Network.loadingFailed', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.finishedAt = event.timestamp * 1000 + clockOffsetMs;
      record.failed = true;
      record.errorText = event.errorText;
    });

    await page.goto(baseUrl + '/', { waitUntil: 'load', timeout: 90000 });
    const choice = page.locator('#brandSplashStatic [data-go="' + brand + '"], #brandSplash [data-go="' + brand + '"]').first();
    await choice.waitFor({ state: 'visible', timeout: 60000 });
    if (captureTrace) {
      await startTrace(cdp);
      tracing = true;
    }
    if (delayMs) await page.waitForTimeout(delayMs);
    await choice.click();
    await page.waitForFunction(() => Number.isFinite(window.__perfExpTap), null, { timeout: 5000 });
    const tapAt = await page.evaluate(() => window.__perfExpTap);
    row.clickAt = tapAt;

    const targetDeadline = Date.now() + 8000;
    while (!targetPaths.length && Date.now() < targetDeadline) await page.waitForTimeout(20);
    const deadline = Date.now() + 30000;
    let cardMark = null;
    while (!cardMark && Date.now() < deadline && targetPaths.length) {
      cardMark = await page.evaluate(({ brandName, paths }) => {
        const grid = document.querySelector(brandName === 'delivery' ? '#deliveryGrid' : '#grid');
        if (!grid) return null;
        const cards = [...grid.querySelectorAll('.card:not(.skeleton-card)')];
        for (const card of cards) {
          const image = card.querySelector('.media img');
          if (!image || !image.complete || image.naturalWidth <= 0) continue;
          let pathname = '';
          try { pathname = new URL(image.currentSrc || image.src, location.href).pathname; } catch (_) {}
          if (!paths.includes(pathname)) continue;
          const rect = card.getBoundingClientRect();
          const style = getComputedStyle(card);
          const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight &&
            style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
          if (visible) return { at: performance.timeOrigin + performance.now(), pathname };
        }
        return null;
      }, { brandName: brand, paths: targetPaths });
      if (!cardMark) await page.waitForTimeout(20);
    }
    row.cardAt = cardMark?.at ?? null;
    row.clickToCardMs = cardMark ? cardMark.at - tapAt : null;
    row.failedRuns = cardMark ? 0 : 1;

    const json = row.requests.find((request) => request.type === 'api' && request.pathname === (brand === 'delivery' ? '/api/dmenu' : '/api/menu'));
    const image = row.requests.filter((request) => request.type === 'image' && targetPaths.includes(request.pathname))
      .sort((a, b) => a.startedAt - b.startedAt)[0];
    const diff = (at) => at == null ? null : Math.round(at - tapAt);
    row.phases = {
      jsonRequestStartMs: diff(json?.startedAt),
      jsonResponseReceivedMs: diff(json?.responseAt),
      jsonLoadingFinishedMs: diff(json?.finishedAt),
      firstImageRequestStartMs: diff(image?.startedAt),
      firstImageResponseReceivedMs: diff(image?.responseAt),
      firstImageLoadingFinishedMs: diff(image?.finishedAt),
      firstCardVisibleMs: row.clickToCardMs,
      imageBytes: image?.encodedDataLength ?? null,
    };
    const before = row.requests.filter((request) => request.startedAt < tapAt);
    const after = row.requests.filter((request) => request.startedAt >= tapAt);
    row.bytesBeforeClick = before.reduce((sum, request) => {
      if (request.finishedAt !== null && request.finishedAt < tapAt) return sum + request.encodedDataLength;
      return sum + request.dataChunks.filter((chunk) => chunk.at < tapAt)
        .reduce((subtotal, chunk) => subtotal + chunk.encodedDataLength, 0);
    }, 0);
    row.requestsBeforeClick = before.length;
    row.requestsAfterClick = after.length;
    row.apiRequestsBeforeClick = before.filter((request) => request.type === 'api').length;
    row.apiRequestsAfterClick = after.filter((request) => request.type === 'api').length;
    row.imageRequestsBeforeClick = before.filter((request) => request.type === 'image').length;
    row.imageRequestsAfterClick = after.filter((request) => request.type === 'image').length;
    row.failedRequests = row.requests.filter((request) => request.failed).map((request) => ({
      pathname: request.pathname, errorText: request.errorText, status: request.status,
    }));
    if (!cardMark) {
      const prefix = 'failure-' + variant + '-' + brand + '-delay' + delayMs + '-run' + runNumber;
      await page.screenshot({ path: path.join(outputDir, prefix + '.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(outputDir, prefix + '.json'), JSON.stringify(row, null, 2));
    }
    if (captureTrace && cardMark && tracing) {
      const tracePath = path.join(outputDir, 'trace-' + variant + '-' + brand + '.json');
      row.trace = await finishTrace(cdp, tapAt, cardMark.at, clockOffsetMs, tracePath);
      tracing = false;
    }
    return row;
  } catch (error) {
    row.error = error.message;
    row.failedRuns = 1;
    fs.writeFileSync(path.join(outputDir, 'error-' + variant + '-' + brand + '-delay' + delayMs + '-run' + runNumber + '.json'), JSON.stringify(row, null, 2));
    return row;
  } finally {
    if (tracing && cdp) await cdp.send('Tracing.end').catch(() => {});
    if (cdp) await cdp.detach().catch(() => {});
    await context.close();
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const records = [];
const traceRecords = [];
try {
  for (const variant of ['A', 'F', 'C8']) {
    for (const delay of delays) {
      for (const brand of brands) {
        for (let run = 1; run <= runs; run += 1) {
          records.push(await runOnce(browser, variant, brand, delay, run, false));
        }
      }
    }
  }
  if (traceSamples) {
    for (const variant of ['A', 'F', 'C8']) {
      for (const brand of brands) {
        traceRecords.push(await runOnce(browser, variant, brand, 0, 90, true));
      }
    }
  }
} finally {
  await browser.close();
}

const summary = [];
for (const variant of ['A', 'F', 'C8']) {
  for (const delay of delays) {
    for (const brand of brands) {
      const rows = records.filter((row) => row.variant === variant && row.delayMs === delay && row.brand === brand);
      const get = (key) => rows.map((row) => row[key]);
      summary.push({
        variant, brand, delayMs: delay, runs: rows.length,
        clickToCardMs: stats(get('clickToCardMs')),
        bytesBeforeClick: stats(get('bytesBeforeClick')),
        requestsBeforeClick: stats(get('requestsBeforeClick')),
        requestsAfterClick: stats(get('requestsAfterClick')),
        apiRequestsBeforeClick: stats(get('apiRequestsBeforeClick')),
        apiRequestsAfterClick: stats(get('apiRequestsAfterClick')),
        imageRequestsBeforeClick: stats(get('imageRequestsBeforeClick')),
        imageRequestsAfterClick: stats(get('imageRequestsAfterClick')),
        failedRuns: rows.reduce((sum, row) => sum + (row.failedRuns || 0), 0),
      });
    }
  }
}
const phaseSummary = [];
for (const variant of ['A', 'F', 'C8']) {
  for (const brand of brands) {
    const rows = records.filter((row) => row.variant === variant && row.delayMs === 0 && row.brand === brand);
    phaseSummary.push({
      variant, brand, delayMs: 0,
      phases: Object.fromEntries([
        'jsonRequestStartMs', 'jsonResponseReceivedMs', 'jsonLoadingFinishedMs',
        'firstImageRequestStartMs', 'firstImageResponseReceivedMs',
        'firstImageLoadingFinishedMs', 'firstCardVisibleMs', 'imageBytes',
      ].map((key) => [key, stats(rows.map((row) => row.phases?.[key]))])),
    });
  }
}
const result = {
  meta: {
    runsPerBrandPerDelay: runs,
    delays,
    brands,
    variants: ['A', 'F', 'C8'],
    viewport: '360x800',
    deviceScaleFactor: 1.75,
    networkLatencyMs: network.latency,
    throughputBytesPerSecond: network.throughputBytesPerSecond,
    cpuSlowdown: 4,
    pinnedA: '8f276411f337952183864684e0bed5558d5e18d9',
    pinnedF: 'aa3a958291948a7b2eda04bcbc9c3cf34385b4aa',
    C8Patch: 'benchmark response rewrite of A index.html; no application source changes',
    tracesAreSeparateFromPrimaryMetrics: true,
  },
  summary, phaseSummary, records, traceRecords,
};
fs.writeFileSync(path.join(outputDir, 'perf-exp-results.json'), JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify({ summary, phaseSummary, traceRecords: traceRecords.map((row) => ({
  variant: row.variant, brand: row.brand, phases: row.phases, trace: row.trace, error: row.error,
})) }, null, 2) + '\n');
