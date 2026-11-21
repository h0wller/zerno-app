#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? '1'];
  })
);
const baseUrl = args.url;
const label = args.label;
const runs = Number(args.runs || 5);
const outDir = path.resolve(args.out || 'splash-results');
if (!baseUrl || !label) {
  throw new Error('usage: --url=http://127.0.0.1:PORT --label=A [--runs=5] [--out=dir]');
}

const THROUGHPUT = (1638.4 * 1024) / 8; // bytes/s, как в Lighthouse-профиле
const BRANDS = ['coffee', 'delivery'];

// Выполняется внутри страницы: отмечает, когда появились preload и первая карточка.
function startProbe(brand) {
  const imageSelector = brand === 'delivery'
    ? '#deliveryGrid > .card:not(.skeleton-card) .media img'
    : '#grid > .card .media img';
  const probe = { cardAt: null, preloadAt: null };
  window.__splashProbe = probe;
  const tick = () => {
    const now = Date.now();
    if (probe.preloadAt === null && document.querySelector('link[rel="preload"][as="image"]')) {
      probe.preloadAt = now;
    }
    const image = document.querySelector(imageSelector);
    if (
      probe.cardAt === null && image && image.complete &&
      image.naturalWidth > 0 && image.getClientRects().length > 0
    ) {
      probe.cardAt = now;
    }
    if (probe.cardAt === null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function runOnce(browser, brand) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block'
  });
  try {
    await context.addInitScript(() => {
      try { localStorage.setItem('zt_inst_hide', '1'); } catch { /* ignore */ }
    });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: THROUGHPUT,
      uploadThroughput: THROUGHPUT
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const requests = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/menu' || pathname === '/api/dmenu' || pathname.startsWith('/media/dishes/')) {
        requests.push({ pathname, at: Date.now() });
      }
    });

    await page.goto(baseUrl + '/', { waitUntil: 'load', timeout: 90000 });
    const choice = page
      .locator(`#brandSplashStatic [data-go="${brand}"], #brandSplash [data-go="${brand}"]`)
      .first();
    await choice.waitFor({ state: 'visible', timeout: 60000 });

    const apiBeforeClick = requests.filter((r) => r.pathname.startsWith('/api/')).length;
    const preloadBeforeClick = await page.evaluate(
      () => Boolean(document.querySelector('link[rel="preload"][as="image"]'))
    );

    await page.evaluate(startProbe, brand);
    const clickAt = Date.now();
    await choice.click();
    await page
      .waitForFunction(() => window.__splashProbe && window.__splashProbe.cardAt !== null, null, { timeout: 60000 })
      .catch(() => {});
    const probe = await page.evaluate(() => window.__splashProbe);

    const after = requests.filter((r) => r.at >= clickAt);
    const count = (name) => after.filter((r) => r.pathname === name).length;
    const firstDish = after.find((r) => r.pathname.startsWith('/media/dishes/'));
    return {
      brand,
      clickToCardMs: probe.cardAt === null ? null : probe.cardAt - clickAt,
      clickToPreloadMs: probe.preloadAt === null ? null : probe.preloadAt - clickAt,
      clickToFirstDishRequestMs: firstDish ? firstDish.at - clickAt : null,
      apiBeforeClick,
      preloadBeforeClick,
      menuRequestsAfterClick: count('/api/menu'),
      dmenuRequestsAfterClick: count('/api/dmenu')
    };
  } finally {
    await context.close();
  }
}

function stats(values) {
  const numbers = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!numbers.length) return null;
  const mid = Math.floor(numbers.length / 2);
  const median = numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
  return { median, min: numbers[0], max: numbers[numbers.length - 1], n: numbers.length };
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const records = [];
try {
  for (const brand of BRANDS) {
    for (let index = 0; index < runs; index += 1) {
      records.push({ run: index + 1, ...(await runOnce(browser, brand)) });
    }
  }
} finally {
  await browser.close();
}

const summary = BRANDS.map((brand) => {
  const rows = records.filter((r) => r.brand === brand);
  return {
    label,
    brand,
    runs: rows.length,
    clickToCardMs: stats(rows.map((r) => r.clickToCardMs)),
    clickToPreloadMs: stats(rows.map((r) => r.clickToPreloadMs)),
    clickToFirstDishRequestMs: stats(rows.map((r) => r.clickToFirstDishRequestMs)),
    failedRuns: rows.filter((r) => r.clickToCardMs === null).length,
    maxApiBeforeClick: Math.max(...rows.map((r) => r.apiBeforeClick)),
    anyPreloadBeforeClick: rows.some((r) => r.preloadBeforeClick),
    maxMenuRequestsAfterClick: Math.max(...rows.map((r) => r.menuRequestsAfterClick)),
    maxDmenuRequestsAfterClick: Math.max(...rows.map((r) => r.dmenuRequestsAfterClick))
  };
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `splash-${label}.json`), JSON.stringify({ label, records, summary }, null, 2));
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
