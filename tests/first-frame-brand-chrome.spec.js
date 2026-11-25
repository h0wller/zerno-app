import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const VIEWPORTS = [
  { name: 'mobile-narrow', width: 320, height: 740 },
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'short-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 }
];

function logoFor(brand) {
  return brand === 'delivery'
    ? { src: '/friday-logo.svg', width: 160, height: 40, alt: 'Пятница' }
    : { src: '/andCoffee.svg', width: 42, height: 42, alt: '…и кофе' };
}

async function waitForDeferredTheme(page) {
  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => link.href.includes('/app/ui/theme/'));
    return links.length > 0 &&
      links.every((link) => link.media !== 'print' && link.sheet !== null);
  }, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

async function holdBeforeBundle(page, brand, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript((selectedBrand) => {
    localStorage.setItem('zt_brand', selectedBrand);
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.removeItem('zt_user');
    sessionStorage.setItem('splashDone', '1');
  }, brand);

  let resumeBundle;
  const bundleGate = new Promise((resolve) => { resumeBundle = resolve; });
  await page.route('**/dist/main.bundle.js*', (route) =>
    bundleGate.then(() => route.continue())
  );

  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#zt-early-chrome-guard')).toBeAttached();
  await expect(page.locator('#brandMark')).toBeAttached();
  await expect(page.locator('#brandTitle')).toBeAttached();
  await page.evaluate(() => {
    window.__brandLogoAtFirstFrame = document.getElementById('brandLogoImg');
  });
  return resumeBundle;
}

async function measureHeader(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom
      };
    };
    const title = document.getElementById('brandTitle');
    const bean = title && title.querySelector('.bean');
    const svg = bean && bean.querySelector('svg');
    return {
      mark: rect(document.getElementById('brandMark')),
      title: rect(title),
      bean: bean ? {
        box: rect(bean),
        svg: rect(svg),
        display: getComputedStyle(bean).display,
        fontSize: parseFloat(getComputedStyle(title).fontSize)
      } : null
    };
  });
}

for (const viewport of VIEWPORTS) {
  test(`FP-001: coffee bean first-frame geometry is stable at ${viewport.name}`, async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const resumeBundle = await holdBeforeBundle(page, 'coffee', viewport);
    const before = await measureHeader(page);

    expect(before.bean).not.toBeNull();
    expect(before.bean.display).toBe('inline-block');
    expect(before.bean.box.width).toBeCloseTo(before.bean.fontSize * 0.8, 1);
    expect(before.bean.box.height).toBeCloseTo(before.bean.fontSize * 0.8, 1);
    expect(before.bean.svg.width).toBeCloseTo(before.bean.box.width, 1);
    expect(before.bean.svg.height).toBeCloseTo(before.bean.box.height, 1);

    await testInfo.attach(`coffee-${viewport.name}-bean-before-hydration.png`, {
      body: await page.screenshot(),
      contentType: 'image/png'
    });

    resumeBundle();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof window.applyBrandChrome === 'function');
    await waitForDeferredTheme(page);
    const after = await measureHeader(page);

    for (const key of ['x', 'y', 'width', 'height']) {
      expect(Math.abs(after.bean.box[key] - before.bean.box[key]),
        `bean ${key} remains stable after hydration`).toBeLessThanOrEqual(1);
      expect(Math.abs(after.bean.svg[key] - before.bean.svg[key]),
        `bean SVG ${key} remains stable after hydration`).toBeLessThanOrEqual(1);
      expect(Math.abs(after.title[key] - before.title[key]),
        `wordmark ${key} remains stable after hydration`).toBeLessThanOrEqual(1);
    }

    await testInfo.attach(`coffee-${viewport.name}-bean-after-hydration.png`, {
      body: await page.screenshot(),
      contentType: 'image/png'
    });
  });
}

for (const brand of ['coffee', 'delivery']) {
  for (const viewport of VIEWPORTS) {
    test(`FP-003: ${brand} actual logo is present before hydration and sync is idempotent at ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(60000);
      const resumeBundle = await holdBeforeBundle(page, brand, viewport);
      const expected = logoFor(brand);
      const logo = page.locator('#brandLogoImg');

      await expect(logo).toBeAttached();
      await expect(logo).toHaveAttribute('src', expected.src);
      await expect(logo).toHaveAttribute('alt', expected.alt);
      await expect(logo).toHaveAttribute('width', String(expected.width));
      await expect(logo).toHaveAttribute('height', String(expected.height));
      await expect.poll(() => logo.evaluate((img) =>
        img.complete && img.naturalWidth > 0
      ), { timeout: 12000 }).toBe(true);
      await logo.evaluate((img) => img.decode());

      await testInfo.attach(`${brand}-${viewport.name}-logo-before-hydration.png`, {
        body: await page.screenshot(),
        contentType: 'image/png'
      });

      resumeBundle();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.applyBrandChrome === 'function');
      await waitForDeferredTheme(page);
      await page.evaluate(() => {
        window.applyBrandChrome(true);
        window.applyBrandChrome(true);
      });

      expect(await page.evaluate(() =>
        window.__brandLogoAtFirstFrame === document.getElementById('brandLogoImg')
      )).toBe(true);

      const nextBrand = brand === 'coffee' ? 'delivery' : 'coffee';
      await page.evaluate((selectedBrand) => {
        window.brand = selectedBrand;
        document.documentElement.setAttribute('data-brand', selectedBrand);
        document.body.setAttribute('data-brand', selectedBrand);
        window.applyBrandChrome(true);
      }, nextBrand);
      await expect(logo).toHaveAttribute('src', logoFor(nextBrand).src);
      expect(await page.evaluate(() =>
        window.__brandLogoAtFirstFrame === document.getElementById('brandLogoImg')
      )).toBe(true);

      await page.evaluate((selectedBrand) => {
        window.brand = selectedBrand;
        document.documentElement.setAttribute('data-brand', selectedBrand);
        document.body.setAttribute('data-brand', selectedBrand);
        window.applyBrandChrome(true);
      }, brand);
      await expect(logo).toHaveAttribute('src', expected.src);
      expect(await page.evaluate(() =>
        window.__brandLogoAtFirstFrame === document.getElementById('brandLogoImg')
      )).toBe(true);

      await testInfo.attach(`${brand}-${viewport.name}-logo-after-hydration.png`, {
        body: await page.screenshot(),
        contentType: 'image/png'
      });
    });
  }
}
