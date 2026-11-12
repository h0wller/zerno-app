import { test, expect } from '@playwright/test';

test.describe('Desktop delivery card layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#deliveryGrid .card').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
  });

  test('uses the production four-column desktop grid', async ({ page }) => {
    const columns = await page.locator('#deliveryGrid').evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').length
    );
    expect(columns, 'desktop delivery catalog must render four columns').toBe(4);
  });

  test('pizza composition descriptions are fully visible on desktop', async ({ page }) => {
    const descriptions = page.locator('#deliveryGrid .cbody .desc');
    await expect(descriptions.first()).toBeVisible();
    const measurements = await descriptions.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent.trim(),
        display: style.display,
        overflow: style.overflow,
        lineClamp: style.webkitLineClamp,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight
      };
    }));

    expect(measurements.length).toBeGreaterThan(0);
    for (const item of measurements) {
      expect(item.display, item.text).toMatch(/^(block|flow-root)$/);
      expect(item.overflow, item.text).toBe('visible');
      expect(item.lineClamp, item.text).toBe('none');
      expect(
        item.scrollHeight,
        `Composition is clipped: ${item.scrollHeight}px content inside ${item.clientHeight}px`
      ).toBeLessThanOrEqual(item.clientHeight + 1);
    }
  });

  test('pizza crust labels are not ellipsized on desktop', async ({ page }) => {
    const crusts = page.locator('#deliveryGrid .opts .opt-crust');
    await expect(crusts.first()).toBeVisible();
    await expect(crusts.filter({ hasText: 'тонкое' }).first()).toBeVisible();

    const widths = await crusts.evaluateAll((nodes) => nodes.map((node) => ({
      text: node.textContent.trim(),
      renderedWidth: node.getBoundingClientRect().width,
      scrollWidth: node.scrollWidth
    })));

    expect(widths.length).toBeGreaterThan(0);
    for (const item of widths) {
      expect(item.text, 'full crust name should remain in the DOM').toMatch(/^(пышное|тонкое)$/);
      expect(
        item.scrollWidth,
        `Crust label "${item.text}" is clipped: ${item.scrollWidth}px inside ${item.renderedWidth}px`
      ).toBeLessThanOrEqual(item.renderedWidth + 1);
    }
  });

  test('pizza size and crust labels stay inside option buttons at four columns', async ({ page }) => {
    await page.evaluate(() => {
      window.dcat = 'pizza';
      window.renderDeliveryMenu();
    });
    const options = page.locator('#deliveryGrid .opts .opt-btn');
    await expect(options.first()).toBeVisible();

    const measurements = await options.evaluateAll((nodes) => nodes.map((button) => {
      const row = button.querySelector('.opt-top');
      const size = row?.querySelector('.opt-size');
      const crust = row?.querySelector('.opt-crust');
      if (!row || !size || !crust) return null;
      const rowRect = row.getBoundingClientRect();
      const sizeRect = size.getBoundingClientRect();
      const crustRect = crust.getBoundingClientRect();
      return {
        rowWidth: rowRect.width,
        rowScrollWidth: row.scrollWidth,
        crustScrollWidth: crust.scrollWidth,
        crustClientWidth: crust.clientWidth,
        sizeRight: sizeRect.right,
        crustRight: crustRect.right,
        rowRight: rowRect.right,
        sizeText: size.textContent.trim(),
        crustText: crust.textContent.trim()
      };
    }));

    expect(measurements.length).toBeGreaterThan(0);
    for (const item of measurements) {
      expect(item, 'each option must expose both size and crust labels').not.toBeNull();
      expect(
        item.sizeRight,
        `Size label "${item.sizeText}" exceeds its option row`
      ).toBeLessThanOrEqual(item.rowRight + 0.5);
      expect(
        item.crustRight,
        `Crust label "${item.crustText}" exceeds its option row`
      ).toBeLessThanOrEqual(item.rowRight + 0.5);
      expect(
        item.rowScrollWidth,
        `Option top row overflows: ${JSON.stringify(item)}`
      ).toBeLessThanOrEqual(item.rowWidth + 1);
      expect(
        item.crustScrollWidth,
        `Crust label "${item.crustText}" is clipped inside its option button`
      ).toBeLessThanOrEqual(item.crustClientWidth + 1);
    }
  });

  test('pizza option groups align after variable-length descriptions', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      window.dcat = 'pizza';
      window.renderDeliveryMenu();
    });
    const cards = page.locator('#deliveryGrid .card:not(.skeleton-card)');
    await expect(cards.first()).toBeVisible();
    await expect.poll(() => cards.count()).toBeGreaterThan(1);
    await page.addStyleTag({ content: '#deliveryGrid > .card { content-visibility: visible !important; contain-intrinsic-block-size: auto !important; }' });
    for (const card of await cards.all()) await card.scrollIntoViewIfNeeded();
    await testInfo.attach('delivery-pizza-four-columns', {
      body: await page.locator('#deliveryGrid').screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });

    const rows = await page.evaluate(() => {
      const groups = new Map();
      for (const card of document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)')) {
        const rect = card.getBoundingClientRect();
        const key = Math.round(rect.top + window.scrollY);
        const legend = card.querySelector('.opts legend');
        const action = card.querySelector('.steprow');
        if (!legend || !action) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({
          optionsTop: Math.round(legend.getBoundingClientRect().top + window.scrollY),
          actionTop: Math.round(action.getBoundingClientRect().top + window.scrollY)
        });
      }
      return [...groups.values()].filter((row) => row.length > 1);
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const field of ['optionsTop', 'actionTop']) {
        const positions = row.map((item) => item[field]);
        expect(Math.max(...positions) - Math.min(...positions), `Pizza ${field} is not aligned: ${positions}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('roll metadata aligns after variable-length composition chips', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      window.dcat = 'rolls';
      window.renderDeliveryMenu();
    });
    const cards = page.locator('#deliveryGrid .card:not(.skeleton-card)');
    await expect(cards.first()).toBeVisible();
    await expect.poll(() => cards.count()).toBeGreaterThan(1);
    await page.addStyleTag({ content: '#deliveryGrid > .card { content-visibility: visible !important; contain-intrinsic-block-size: auto !important; }' });
    for (const card of await cards.all()) await card.scrollIntoViewIfNeeded();
    await testInfo.attach('delivery-rolls-four-columns', {
      body: await page.locator('#deliveryGrid').screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });

    const rows = await page.evaluate(() => {
      const groups = new Map();
      for (const card of document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)')) {
        const rect = card.getBoundingClientRect();
        const key = Math.round(rect.top + window.scrollY);
        const meta = card.querySelector('.single-meta');
        const action = card.querySelector('.steprow');
        if (!meta || !action) continue;
        if (!groups.has(key)) groups.set(key, []);
        const composition = card.querySelector('.comp');
        groups.get(key).push({
          compositionBottom: composition ? Math.round(composition.getBoundingClientRect().bottom + window.scrollY) : null,
          metaTop: Math.round(meta.getBoundingClientRect().top + window.scrollY),
          actionTop: Math.round(action.getBoundingClientRect().top + window.scrollY)
        });
      }
      return [...groups.values()].filter((row) => row.length > 1);
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const item of row) {
        expect(item.compositionBottom, 'roll composition chips must not overlap weight/price')
          .toBeLessThanOrEqual(item.metaTop);
      }
      for (const field of ['metaTop', 'actionTop']) {
        const positions = row.map((item) => item[field]);
        expect(Math.max(...positions) - Math.min(...positions), `Roll ${field} is not aligned: ${positions}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('roll cards keep equal height within each desktop grid row', async ({ page }) => {
    await page.evaluate(() => {
      window.dcat = 'rolls';
      window.renderDeliveryMenu();
    });

    const cards = page.locator('#deliveryGrid .card:not(.skeleton-card)');
    await expect(cards.first()).toBeVisible();
    await expect.poll(() => cards.count()).toBeGreaterThan(1);

    await page.addStyleTag({
      content: '#deliveryGrid > .card { content-visibility: visible !important; contain-intrinsic-block-size: auto !important; }'
    });
    for (const card of await cards.all()) await card.scrollIntoViewIfNeeded();

    const rows = await page.evaluate(() => {
      const byTop = new Map();
      for (const card of document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)')) {
        const rect = card.getBoundingClientRect();
        const key = Math.round(rect.top + window.scrollY);
        if (!byTop.has(key)) byTop.set(key, []);
        byTop.get(key).push(rect.height);
      }
      return [...byTop.values()];
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const heights of rows) {
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    }
  });
});
