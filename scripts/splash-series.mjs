#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? '1'];
}));
const { url, label } = args;
const runs = Number(args.runs || 5);
const brands = (args.brands || 'coffee,delivery').split(',');
const scenarios = (args.scenarios || 'match,mismatch').split(',');
const delays = (args.delays || '0').split(',').map(Number);
const outputDir = path.resolve(args.out || 'splash-results');
const apiPaths = new Set(['/api/menu', '/api/dmenu']);
const throughput = 1638.4 * 1024 / 8;

if (!url || !label || !Number.isInteger(runs) || runs < 1 ||
    brands.some((brand) => !['coffee', 'delivery'].includes(brand)) ||
    scenarios.some((scenario) => !['match', 'mismatch'].includes(scenario)) ||
    delays.some((delay) => ![0, 3000].includes(delay))) {
  throw new Error('Invalid splash-series arguments');
}

function catalogImageUrls(item, origin) {
  if (!item?.img) return [];
  return [item.img, ...(item.imgSrcset || '')
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)]
    .map((candidate) => new URL(candidate, origin).href);
}

function firstCatalogItem(payload, brand) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.find((item) => item?.on && item.img &&
    (brand !== 'delivery' || item.cat === 'pizza')) || null;
}

async function runOnce(browser, selectedBrand, scenario, delayMs, run) {
  const predictedBrand = scenario === 'match'
    ? selectedBrand
    : (selectedBrand === 'delivery' ? 'coffee' : 'delivery');
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block'
  });
  const row = {
    label, scenario, brand: selectedBrand, selectedBrand, predictedBrand,
    delayMs, run, requests: [], console: []
  };
  const requestsById = new Map();
  const imageUrlsByBrand = { coffee: new Set(), delivery: new Set() };
  const firstImageUrlsByBrand = { coffee: [], delivery: [] };
  let selectedImageUrls = [];
  let clickAt = null;

  try {
    await context.addInitScript((savedBrand) => {
      try {
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_brand', savedBrand);
        localStorage.removeItem('zt_user');
      } catch {}
    }, predictedBrand);

    const page = await context.newPage();
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        row.console.push({ type: message.type(), text: message.text() });
      }
    });
    page.on('pageerror', (error) => row.console.push({ type: 'pageerror', text: error.message }));
    page.on('response', async (response) => {
      const responsePath = new URL(response.url()).pathname;
      const responseBrand = responsePath === '/api/dmenu'
        ? 'delivery'
        : (responsePath === '/api/menu' ? 'coffee' : null);
      if (!responseBrand || !response.ok()) return;
      try {
        const payload = await response.json();
        const items = Array.isArray(payload.items) ? payload.items : [];
        for (const item of items) {
          for (const imageUrl of catalogImageUrls(item, url)) {
            imageUrlsByBrand[responseBrand].add(imageUrl);
          }
        }
        const first = firstCatalogItem(payload, responseBrand);
        if (first) firstImageUrlsByBrand[responseBrand] = catalogImageUrls(first, url);
        if (responseBrand === selectedBrand) {
          selectedImageUrls = firstImageUrlsByBrand[responseBrand];
          row.apiItemsCount = items.length;
        }
      } catch (error) {
        row.console.push({ type: 'api-json-error', text: error.message });
      }
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150,
      downloadThroughput: throughput, uploadThroughput: throughput
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    cdp.on('Network.requestWillBeSent', (event) => {
      const pathname = new URL(event.request.url).pathname;
      if (!apiPaths.has(pathname) && !pathname.startsWith('/media/dishes/')) return;
      const request = {
        requestId: event.requestId, pathname, url: event.request.url,
        startedAt: Date.now(), finishedAt: null, status: null,
        encodedDataLength: 0, failed: false
      };
      requestsById.set(event.requestId, request);
      row.requests.push(request);
    });
    cdp.on('Network.responseReceived', (event) => {
      const request = requestsById.get(event.requestId);
      if (request) {
        request.status = event.response.status;
        request.mimeType = event.response.mimeType;
      }
    });
    cdp.on('Network.loadingFinished', (event) => {
      const request = requestsById.get(event.requestId);
      if (request) {
        request.finishedAt = Date.now();
        request.encodedDataLength = event.encodedDataLength || 0;
      }
    });
    cdp.on('Network.loadingFailed', (event) => {
      const request = requestsById.get(event.requestId);
      if (request) {
        request.finishedAt = Date.now();
        request.failed = true;
        request.errorText = event.errorText;
      }
    });

    await page.goto(url + '/', { waitUntil: 'load', timeout: 90000 });
    const choiceSelector = '#brandSplashStatic [data-go="' + selectedBrand +
      '"], #brandSplash [data-go="' + selectedBrand + '"]';
    const choice = page.locator(choiceSelector).first();
    await choice.waitFor({ state: 'visible', timeout: 60000 });
    if (delayMs) await page.waitForTimeout(delayMs);

    const preloadId = predictedBrand === 'delivery'
      ? 'zt-delivery-lcp-preload'
      : 'zt-menu-lcp-preload';
    row.predictedPreloadHrefAtClick = await page.locator('#' + preloadId).getAttribute('href').catch(() => null);
    clickAt = Date.now();
    row.clickAt = clickAt;
    await choice.click();

    const deadline = Date.now() + 25000;
    let cardAt = null;
    while (Date.now() < deadline && cardAt === null) {
      if (selectedImageUrls.length) {
        const selectedImage = await page.evaluate(({ brandName, targetList }) => {
          const grid = document.querySelector(brandName === 'delivery' ? '#deliveryGrid' : '#grid');
          if (!grid) return null;
          const image = [...grid.querySelectorAll('.card:not(.skeleton-card) .media img')].find((candidate) => {
            if (!candidate.currentSrc || !candidate.complete || candidate.naturalWidth <= 0 ||
                !candidate.getClientRects().length) return false;
            try {
              return targetList.includes(new URL(candidate.currentSrc).href);
            } catch {
              return false;
            }
          });
          return image?.currentSrc || null;
        }, { brandName: selectedBrand, targetList: selectedImageUrls });
        if (selectedImage) {
          cardAt = Date.now();
          row.selectedImageUrl = selectedImage;
        }
      }
      if (cardAt === null) await page.waitForTimeout(50);
    }

    row.clickToCardMs = cardAt === null ? null : cardAt - clickAt;
    row.firstCatalogItemUrls = selectedImageUrls;
    row.predictedFirstImageUrls = firstImageUrlsByBrand[predictedBrand];

    if (cardAt !== null) await page.waitForTimeout(500);

    const before = row.requests.filter((request) => request.startedAt < clickAt);
    const after = row.requests.filter((request) => request.startedAt >= clickAt);
    const selectedImageRequest = row.requests.find((request) => request.url === row.selectedImageUrl);
    const hiddenImageSet = imageUrlsByBrand[predictedBrand];
    const predictedFirstSet = new Set(
      row.predictedPreloadHrefAtClick ? firstImageUrlsByBrand[predictedBrand] : []
    );
    const hiddenImageRequests = scenario === 'mismatch'
      ? row.requests.filter((request) => request.pathname.startsWith('/media/dishes/') &&
          hiddenImageSet.has(request.url) && !predictedFirstSet.has(request.url))
      : [];

    row.bytesBeforeClick = before
      .filter((request) => request.finishedAt !== null && request.finishedAt <= clickAt)
      .reduce((sum, request) => sum + request.encodedDataLength, 0);
    row.requestsBeforeClick = before.length;
    row.requestsAfterClick = after.length;
    row.apiRequestsBeforeClick = before.filter((request) => apiPaths.has(request.pathname)).length;
    row.apiRequestsAfterClick = after.filter((request) => apiPaths.has(request.pathname)).length;
    row.dishRequestsBeforeClick = before.filter((request) => request.pathname.startsWith('/media/dishes/')).length;
    row.dishRequestsAfterClick = after.filter((request) => request.pathname.startsWith('/media/dishes/')).length;
    row.selectedImageStatus = selectedImageRequest?.status ?? null;
    row.failedRequests = row.requests.filter((request) => request.failed);
    row.netErrAbortedRequests = row.failedRequests.filter((request) => request.errorText === 'net::ERR_ABORTED');
    row.hiddenImageRequests = hiddenImageRequests;
    const predictionHadSuccessfulJsonBeforeClick = before.some((request) =>
      request.pathname === (predictedBrand === 'delivery' ? '/api/dmenu' : '/api/menu') &&
      request.status === 200
    );
    row.missingPredictedPreload = label === 'C8' &&
      predictionHadSuccessfulJsonBeforeClick && !row.predictedPreloadHrefAtClick;
    row.failedRuns = cardAt === null || row.selectedImageStatus !== 200 ||
      row.failedRequests.length > 0 || row.hiddenImageRequests.length > 0 ||
      row.missingPredictedPreload ? 1 : 0;

    if (row.failedRuns) {
      const prefix = 'failure-' + label + '-' + scenario + '-' + selectedBrand + '-run' + run;
      await page.screenshot({ path: path.join(outputDir, prefix + '.png'), fullPage: true })
        .catch((error) => { row.screenshotError = error.message; });
      fs.writeFileSync(path.join(outputDir, prefix + '.json'), JSON.stringify(row, null, 2));
    }
    return row;
  } catch (error) {
    row.error = error.message;
    row.failedRuns = 1;
    const name = 'error-' + label + '-' + scenario + '-' + selectedBrand + '-run' + run + '.json';
    fs.writeFileSync(path.join(outputDir, name), JSON.stringify(row, null, 2));
    throw error;
  } finally {
    await context.close();
  }
}

function stats(values) {
  const sorted = values.filter((value) => typeof value === 'number').sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0], max: sorted.at(-1), n: sorted.length
  };
}

fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const records = [];
try {
  for (const scenario of scenarios) {
    for (const delay of delays) {
      for (const brand of brands) {
        for (let run = 1; run <= runs; run += 1) {
          records.push(await runOnce(browser, brand, scenario, delay, run));
        }
      }
    }
  }
} finally {
  await browser.close();
}

const summary = scenarios.flatMap((scenario) => delays.flatMap((delay) =>
  brands.map((brand) => {
    const rows = records.filter((record) =>
      record.scenario === scenario && record.delayMs === delay && record.brand === brand
    );
    return {
      label, scenario, brand, delayMs: delay, runs: rows.length,
      clickToCardMs: stats(rows.map((row) => row.clickToCardMs)),
      bytesBeforeClick: stats(rows.map((row) => row.bytesBeforeClick)),
      requestsBeforeClick: stats(rows.map((row) => row.requestsBeforeClick)),
      requestsAfterClick: stats(rows.map((row) => row.requestsAfterClick)),
      apiRequestsBeforeClick: stats(rows.map((row) => row.apiRequestsBeforeClick)),
      apiRequestsAfterClick: stats(rows.map((row) => row.apiRequestsAfterClick)),
      dishRequestsBeforeClick: stats(rows.map((row) => row.dishRequestsBeforeClick)),
      dishRequestsAfterClick: stats(rows.map((row) => row.dishRequestsAfterClick)),
      selectedImageStatus: rows.map((row) => row.selectedImageStatus),
      netErrAbortedRuns: rows.filter((row) => row.netErrAbortedRequests.length > 0).length,
      hiddenImageRequestCount: rows.reduce((sum, row) => sum + row.hiddenImageRequests.length, 0),
      missingPredictedPreloadRuns: rows.filter((row) => row.missingPredictedPreload).length,
      failedRuns: rows.reduce((sum, row) => sum + (row.failedRuns || 0), 0)
    };
  })
));
fs.writeFileSync(
  path.join(outputDir, 'splash-' + label + '.json'),
  JSON.stringify({ label, records, summary }, null, 2)
);
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
