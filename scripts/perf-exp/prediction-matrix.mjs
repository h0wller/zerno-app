#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { installHtmlVariantRoute } from './patch-html.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? '1'];
}));
const baseUrl = args.url;
const runs = Number(args.runs || 5);
const variants = (args.variants || 'A,C8,C9').split(',');
const outputDir = path.resolve(args.out || 'prediction-matrix');
const network = { latency: 150, throughputBytesPerSecond: 1638.4 * 1024 / 8 };
const scenarios = [
  { id: 'a-no-brand-choose-coffee', savedBrand: null, selectedBrand: 'coffee' },
  { id: 'b-no-brand-choose-delivery', savedBrand: null, selectedBrand: 'delivery' },
  { id: 'c-saved-coffee-choose-delivery', savedBrand: 'coffee', selectedBrand: 'delivery' },
  { id: 'd-saved-delivery-choose-coffee', savedBrand: 'delivery', selectedBrand: 'coffee' },
];

if (!baseUrl || !Number.isInteger(runs) || runs < 1 ||
    variants.some((variant) => !['A', 'C8', 'C9'].includes(variant))) {
  throw new Error('Expected --url, --runs=5 and --variants=A,C8,C9');
}
fs.mkdirSync(outputDir, { recursive: true });

function percentile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}
function stats(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? {
    median: percentile(valid, 0.5),
    min: Math.min(...valid),
    max: Math.max(...valid),
    n: valid.length,
  } : null;
}
function pathsFromSrcset(value, origin) {
  return String(value || '').split(',').map((part) => part.trim().split(' ')[0])
    .filter(Boolean).map((url) => new URL(url, origin).pathname);
}
function bytesAt(request, at) {
  if (request.finishedAt !== null && request.finishedAt <= at && !request.failed) {
    return request.encodedDataLength || request.dataReceivedBytes;
  }
  return request.dataChunks.filter((chunk) => chunk.at <= at)
    .reduce((sum, chunk) => sum + chunk.encodedDataLength, 0);
}
function isHiddenImagePath(pathname, hiddenBrand, firstImagePaths) {
  if (firstImagePaths.has(pathname)) return true;
  const leaf = pathname.slice(pathname.lastIndexOf('/') + 1).toLowerCase();
  if (hiddenBrand === 'coffee') return leaf.startsWith('esp-card') && leaf.endsWith('.webp');
  return leaf.startsWith('1-card') && leaf.endsWith('.webp');
}
function preloadPaths(preloads, origin, brand) {
  const result = new Set();
  const expectedId = brand === 'coffee' ? 'zt-menu-lcp-preload' : 'zt-delivery-lcp-preload';
  for (const preload of preloads) {
    if (preload.id !== expectedId) continue;
    try { result.add(new URL(preload.href, origin).pathname); } catch (_) {}
    for (const pathname of pathsFromSrcset(preload.imagesrcset, origin)) result.add(pathname);
  }
  return result;
}

async function runOnce(browser, variant, scenario, runNumber) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const requests = [];
  const requestById = new Map();
  const responseTasks = [];
  const firstImagePaths = new Set();
  const predictedImagePathsAtTap = new Set();
  const hiddenBrand = scenario.selectedBrand === 'coffee' ? 'delivery' : 'coffee';
  const hiddenApiPath = hiddenBrand === 'coffee' ? '/api/menu' : '/api/dmenu';
  const hiddenCategory = hiddenBrand === 'coffee' ? 'coffee' : 'pizza';
  let clockOffsetMs = null;
  let tapAt = null;
  let cardAt = null;
  let tappedBrand = null;

  try {
    await installHtmlVariantRoute(page, variant);
    await context.addInitScript((savedBrand) => {
      try {
        if (savedBrand) localStorage.setItem('zt_brand', savedBrand);
        else localStorage.removeItem('zt_brand');
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.removeItem('zt_user');
        sessionStorage.removeItem('splashDone');
      } catch (_) {}
      document.addEventListener('click', (event) => {
        const choice = event.target && event.target.closest
          ? event.target.closest('#brandSplashStatic [data-go], #brandSplash [data-go]')
          : null;
        if (choice) {
          window.__predictionMatrixTap = {
            at: performance.timeOrigin + performance.now(),
            brand: choice.getAttribute('data-go'),
          };
        }
      }, true);
    }, scenario.savedBrand);

    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: network.latency,
      downloadThroughput: network.throughputBytesPerSecond,
      uploadThroughput: network.throughputBytesPerSecond,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    cdp.on('Network.requestWillBeSent', (event) => {
      const wallTime = Number.isFinite(event.wallTime) ? event.wallTime * 1000 : Date.now();
      const offset = wallTime - event.timestamp * 1000;
      if (clockOffsetMs === null) clockOffsetMs = offset;
      const record = {
        requestId: event.requestId,
        pathname: new URL(event.request.url).pathname,
        url: event.request.url,
        type: event.type || 'Other',
        startedAt: wallTime,
        responseAt: null,
        finishedAt: null,
        status: null,
        encodedDataLength: 0,
        dataReceivedBytes: 0,
        dataChunks: [],
        failed: false,
        errorText: null,
      };
      requestById.set(event.requestId, record);
      requests.push(record);
    });
    cdp.on('Network.responseReceived', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.responseAt = event.timestamp * 1000 + clockOffsetMs;
      record.status = event.response.status;
      record.mimeType = event.response.mimeType;
      record.protocol = event.response.protocol || null;
      record.fromServiceWorker = !!event.response.fromServiceWorker;
      record.fromDiskCache = !!event.response.fromDiskCache;
    });
    cdp.on('Network.dataReceived', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      const size = event.encodedDataLength || 0;
      record.dataReceivedBytes += size;
      record.dataChunks.push({ at: event.timestamp * 1000 + clockOffsetMs, encodedDataLength: size });
    });
    cdp.on('Network.loadingFinished', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.finishedAt = event.timestamp * 1000 + clockOffsetMs;
      record.encodedDataLength = event.encodedDataLength || record.dataReceivedBytes;
    });
    cdp.on('Network.loadingFailed', (event) => {
      const record = requestById.get(event.requestId);
      if (!record) return;
      record.finishedAt = event.timestamp * 1000 + clockOffsetMs;
      record.failed = true;
      record.errorText = event.errorText;
    });

    page.on('response', (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname !== hiddenApiPath || !response.ok()) return;
      responseTasks.push((async () => {
        try {
          const payload = await response.json();
          const items = Array.isArray(payload.items) ? payload.items : [];
          const first = items.find((item) => item && item.on && item.img && item.cat === hiddenCategory);
          if (!first) return;
          firstImagePaths.add(new URL(first.img, baseUrl).pathname);
          for (const itemPath of pathsFromSrcset(first.imgSrcset, baseUrl)) firstImagePaths.add(itemPath);
        } catch (_) {}
      })());
    });

    await page.goto(baseUrl + '/', { waitUntil: 'load', timeout: 90000 });
    const choice = page.locator(
      '#brandSplashStatic [data-go="' + scenario.selectedBrand + '"], ' +
      '#brandSplash [data-go="' + scenario.selectedBrand + '"]',
    ).first();
    await choice.waitFor({ state: 'visible', timeout: 60000 });
    await choice.click();

    await page.waitForFunction(
      () => window.__predictionMatrixTap && window.__predictionMatrixTap.at,
      null,
      { timeout: 5000 },
    );
    const click = await page.evaluate(() => window.__predictionMatrixTap);
    tapAt = click.at;
    tappedBrand = click.brand;
    const preloadsAtTap = await page.evaluate(() => [...document.querySelectorAll('link[rel="preload"][as="image"]')]
      .map((node) => ({ id: node.id, href: node.href, imagesrcset: node.getAttribute('imagesrcset') || '' })));
    for (const pathname of preloadPaths(preloadsAtTap, baseUrl, hiddenBrand)) predictedImagePathsAtTap.add(pathname);

    const cardHandle = await page.waitForFunction((selectedBrand) => {
      const grid = document.querySelector(selectedBrand === 'delivery' ? '#deliveryGrid' : '#grid');
      if (!grid) return null;
      const cards = [...grid.querySelectorAll('.card:not(.skeleton-card)')];
      for (const card of cards) {
        const image = card.querySelector('.media img');
        if (!image || !image.complete || image.naturalWidth <= 0) continue;
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight &&
          style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
        if (visible) return performance.timeOrigin + performance.now();
      }
      return null;
    }, scenario.selectedBrand, { timeout: 60000 });
    cardAt = await cardHandle.jsonValue();
    await Promise.all(responseTasks);

    const preloadsAtCard = await page.evaluate(() => [...document.querySelectorAll('link[rel="preload"][as="image"]')]
      .map((node) => ({ id: node.id, href: node.href, imagesrcset: node.getAttribute('imagesrcset') || '' })));
    const cardPreloadPaths = preloadPaths(preloadsAtCard, baseUrl, hiddenBrand);
    const hiddenImageRequests = (request) => {
      if (request.type !== 'Image' && !request.pathname.startsWith('/media/dishes/')) return false;
      return isHiddenImagePath(request.pathname, hiddenBrand, new Set([
        ...firstImagePaths, ...predictedImagePathsAtTap, ...cardPreloadPaths,
      ]));
    };
    const hiddenRequests = requests.filter((request) =>
      request.pathname === hiddenApiPath || hiddenImageRequests(request));
    const hiddenRequestsBeforeClick = hiddenRequests.filter((request) => request.startedAt < tapAt);
    const bytesBeforeClick = requests.filter((request) => request.startedAt < tapAt)
      .reduce((sum, request) => sum + bytesAt(request, tapAt), 0);
    const wastedJsonBytesBeforeClick = hiddenRequestsBeforeClick
      .filter((request) => request.pathname === hiddenApiPath)
      .reduce((sum, request) => sum + bytesAt(request, tapAt), 0);
    const wastedImageBytesBeforeClick = hiddenRequestsBeforeClick
      .filter(hiddenImageRequests)
      .reduce((sum, request) => sum + bytesAt(request, tapAt), 0);
    const hiddenRequestsThroughCard = hiddenRequests.filter((request) => request.startedAt <= cardAt);
    const wastedJsonBytesThroughCard = hiddenRequestsThroughCard
      .filter((request) => request.pathname === hiddenApiPath)
      .reduce((sum, request) => sum + bytesAt(request, cardAt), 0);
    const wastedImageBytesThroughCard = hiddenRequestsThroughCard
      .filter(hiddenImageRequests)
      .reduce((sum, request) => sum + bytesAt(request, cardAt), 0);

    return {
      variant,
      scenario: scenario.id,
      savedBrand: scenario.savedBrand,
      selectedBrand: scenario.selectedBrand,
      predictedBrand: variant === 'C9' && !scenario.savedBrand ? 'coffee' : scenario.savedBrand,
      clickToCardMs: cardAt - tapAt,
      bytesBeforeClick,
      wastedJsonBytesBeforeClick,
      wastedImageBytesBeforeClick,
      wastedBytesBeforeClick: wastedJsonBytesBeforeClick + wastedImageBytesBeforeClick,
      hiddenRequestsBeforeClick: hiddenRequestsBeforeClick.length,
      hiddenJsonRequestsBeforeClick: hiddenRequestsBeforeClick.filter((request) => request.pathname === hiddenApiPath).length,
      hiddenImageRequestsBeforeClick: hiddenRequestsBeforeClick.filter(hiddenImageRequests).length,
      hiddenRequestsThroughCard: hiddenRequestsThroughCard.length,
      wastedBytesThroughCard: wastedJsonBytesThroughCard + wastedImageBytesThroughCard,
      tappedBrand,
      preloadPathsAtTap: [...predictedImagePathsAtTap],
      hiddenImagePathsFromJson: [...firstImagePaths],
      failures: requests.filter((request) => request.failed).map((request) => ({
        pathname: request.pathname, errorText: request.errorText,
      })),
    };
  } catch (error) {
    return {
      variant, scenario: scenario.id, savedBrand: scenario.savedBrand,
      selectedBrand: scenario.selectedBrand, error: error.message,
      clickToCardMs: null, bytesBeforeClick: null,
      wastedJsonBytesBeforeClick: null, wastedImageBytesBeforeClick: null,
      wastedBytesBeforeClick: null, hiddenRequestsBeforeClick: null,
      hiddenRequestsThroughCard: null,
    };
  } finally {
    await cdp.detach().catch(() => {});
    await context.close();
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const records = [];
try {
  for (const variant of variants) {
    for (const scenario of scenarios) {
      for (let run = 1; run <= runs; run += 1) {
        records.push({ run, ...(await runOnce(browser, variant, scenario, run)) });
      }
    }
  }
} finally {
  await browser.close();
}

const summary = [];
for (const variant of variants) {
  for (const scenario of scenarios) {
    const rows = records.filter((row) => row.variant === variant && row.scenario === scenario.id);
    for (const key of [
      'clickToCardMs', 'bytesBeforeClick', 'wastedJsonBytesBeforeClick',
      'wastedImageBytesBeforeClick', 'wastedBytesBeforeClick',
      'hiddenRequestsBeforeClick', 'hiddenJsonRequestsBeforeClick',
      'hiddenImageRequestsBeforeClick', 'hiddenRequestsThroughCard', 'wastedBytesThroughCard',
    ]) {
      // Preserve a per-scenario statistic block, not per-run values only.
    }
    const metrics = {};
    for (const key of [
      'clickToCardMs', 'bytesBeforeClick', 'wastedJsonBytesBeforeClick',
      'wastedImageBytesBeforeClick', 'wastedBytesBeforeClick',
      'hiddenRequestsBeforeClick', 'hiddenJsonRequestsBeforeClick',
      'hiddenImageRequestsBeforeClick', 'hiddenRequestsThroughCard', 'wastedBytesThroughCard',
    ]) metrics[key] = stats(rows.map((row) => row[key]));
    summary.push({
      variant,
      scenario: scenario.id,
      savedBrand: scenario.savedBrand,
      selectedBrand: scenario.selectedBrand,
      predictedBrand: variant === 'C9' && !scenario.savedBrand ? 'coffee' : scenario.savedBrand,
      runs: rows.length,
      failedRuns: rows.filter((row) => row.error).length,
      metrics,
    });
  }
}

const result = {
  meta: {
    runsPerScenario: runs,
    variants,
    scenarios,
    viewport: '360x800',
    deviceScaleFactor: 1.75,
    networkLatencyMs: network.latency,
    throughputBytesPerSecond: network.throughputBytesPerSecond,
    cpuSlowdown: 4,
    pinnedA: '8f276411f337952183864684e0bed5558d5e18d9',
    note: 'Wasted bytes mean bytes received for the unselected brand before click; through-card counts include any late speculative preload until selected first card.',
  },
  summary,
  records,
};
fs.writeFileSync(path.join(outputDir, 'prediction-matrix.json'), JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify({ summary }, null, 2) + '\\n');
