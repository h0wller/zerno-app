import { test, expect } from '@playwright/test';

const imageFixture = Array.from({ length: 6 }, (_, index) => ({
  id: 'responsive-image-' + index,
  cat: 'pizza',
  section: 'delivery',
  name: 'LCP fixture ' + index,
  desc: '',
  comp: ['томатный соус', 'моцарелла'],
  opts: [{ l: '25 см, пышное', w: '415 г', p: 535, sz: 25 }],
  price: 500,
  e: '🍕',
  on: 1,
  img: '/media/dishes/1-card.webp'
}));

async function routeImageDeliveryFixture(page) {
  await page.route('**/dmenu**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: imageFixture })
  }));
  await page.route(/\/media\/dishes\/.*$/, (route) => route.fulfill({
    status: 200,
    contentType: 'image/gif',
    body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
  }));
}

async function waitForDeferredTheme(page) {
  try {
    await page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter((link) => link.href.includes('/app/ui/theme/'));
      return links.length > 0 &&
        links.every((link) => link.media !== 'print' && link.sheet !== null);
    }, null, { timeout: 20000 });
  } catch (error) {
    const status = await page.evaluate(() => Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    ).filter((link) => link.href.includes('/app/ui/theme/')).map((link) => ({
      href: link.href,
      media: link.media,
      loaded: link.sheet !== null
    })));
    throw new Error(`Deferred theme CSS did not finish loading: ${JSON.stringify(status)}`, { cause: error });
  }
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
}

test.describe('Slow network: first viewport stays styled before deferred CSS', () => {
  test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

  test('delivery menu keeps its content column and product card geometry', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
      window.__layoutShifts = [];
      window.__layoutShiftDetails = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__layoutShifts.push(entry.value);
              window.__layoutShiftDetails.push({
                value: entry.value,
                startTime: entry.startTime,
                sources: (entry.sources || []).map((source) => {
                  const node = source.node;
                  return {
                    node: node ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${typeof node.className === 'string' && node.className ? `.${node.className.trim().replace(/\s+/g, '.')}` : ''}` : null,
                    previousRect: source.previousRect,
                    currentRect: source.currentRect
                  };
                })
              });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
    });

    await routeImageDeliveryFixture(page);
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    const deliveryResponse = page.waitForResponse((res) =>
      new URL(res.url()).pathname.replace(/\/+$/, '').endsWith('/dmenu'), { timeout: 5000 }
    );
    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    const response = await deliveryResponse;
    expect(response.ok()).toBeTruthy();
    const items = (await response.json()).items;
    expect(items).toHaveLength(6);
    expect(items[0].id).toBe('responsive-image-0');
    await expect(page.locator('#deliveryView')).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => {
      const rail = document.querySelector('#deliveryRail');
      return rail &&
        rail.classList.contains('rail-position-ready') &&
        getComputedStyle(rail).display !== 'none' &&
        rail.getBoundingClientRect().width > 0;
    }, null, { timeout: 10000 });
    await expect(page.locator('#deliveryGrid > .card[data-product-id]').first()).toBeAttached({ timeout: 10000 });

    const productCards = page.locator('#deliveryGrid > .card[data-product-id]');
    const images = await productCards.locator('img').evaluateAll((nodes) =>
      nodes.map((image) => ({
        loading: image.getAttribute('loading'),
        priority: image.getAttribute('fetchpriority')
      }))
    );
    const firstCardImage = productCards.first().locator('img');
    if (await firstCardImage.count()) {
      await expect(firstCardImage).toHaveAttribute('fetchpriority', 'high');
      await expect(firstCardImage).toHaveAttribute('loading', 'eager');
    }
    expect(images.filter((image) => image.priority === 'high')).toHaveLength(images.length ? 1 : 0);
    expect(images.filter((image) => image.loading === 'eager')).toHaveLength(images.length ? 1 : 0);

    const measure = () => page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
      };
      const ticker = document.querySelector('.ticker');
      const header = document.querySelector('header.topbar');
      const heading = document.querySelector('#deliveryView .menu-head h1');
      const card = document.querySelector('#deliveryGrid > .card');
      const media = card && card.querySelector('.media');
      const brandTitle = document.querySelector('#brandTitle');
      const brandSub = document.querySelector('#brandSub');
      return {
        ticker: box(ticker),
        header: box(header),
        headerStyle: header && {
          height: getComputedStyle(header).height,
          minHeight: getComputedStyle(header).minHeight,
          paddingTop: getComputedStyle(header).paddingTop,
          paddingBottom: getComputedStyle(header).paddingBottom,
          gridTemplateRows: getComputedStyle(header).gridTemplateRows
        },
        tickerOverflowX: ticker && getComputedStyle(ticker).overflowX,
        heading: box(heading),
        brandContext: box(document.querySelector('#deliveryView .menu-head h1 em')),
        menuHead: box(document.querySelector('#deliveryView .menu-head')),
        menuHeadStyle: (() => { const style = getComputedStyle(document.querySelector('#deliveryView .menu-head')); return { maxHeight: style.maxHeight, overflow: style.overflow }; })(),
        subchipHeight: document.querySelector('#deliverySubFilter .subchip')?.getBoundingClientRect().height,
        card: box(card),
        media: box(media),
        brandMark: box(document.querySelector('#brandMark')),
        brandTitleDisplay: brandTitle && getComputedStyle(brandTitle).display,
        brandSubDisplay: brandSub && getComputedStyle(brandSub).display,
        search: box(document.querySelector('#deliveryView .mh-right .search')),
        addButton: box(document.querySelector('#deliveryGrid .cta[data-add]')),
        addRow: box(document.querySelector('#deliveryGrid .cta[data-add]')?.closest('.steprow')),
        activeSubchipColor: document.querySelector('#deliverySubFilter .subchip.on') && getComputedStyle(document.querySelector('#deliverySubFilter .subchip.on')).backgroundColor,
        searchLabel: box(document.querySelector('#deliveryView label[for="dSearch"]')),
        searchInput: box(document.querySelector('#dSearch')),
        updated: box(document.querySelector('#deliveryView .menu-head .upd')),
        subchip: box(document.querySelector('#deliverySubFilter .subchip')),
        option: box(document.querySelector('#deliveryGrid .opts .opt-btn')),
        section: box(document.querySelector('.wrap > section')),
        rail: box(document.querySelector('.wrap > .rail:not([style*="display: none"])')),
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      };
    });

    const before = await measure();
    console.log('[slow-network-layout] before deferred CSS', JSON.stringify(before));
    expect(before.ticker).not.toBeNull();
    expect(before.ticker.height).toBe(34);
    expect(before.tickerOverflowX).toBe('hidden');
    expect(before.section.width).toBeGreaterThan(250);
    expect(before.section.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.heading.width).toBeGreaterThan(60);
    expect(before.brandContext).not.toBeNull();
    expect(before.brandContext.width).toBeGreaterThan(0);
    expect(before.menuHead).not.toBeNull();
    expect(before.menuHead.x).toBeLessThanOrEqual(before.rail.x + 1);
    expect(before.menuHead.right).toBeGreaterThanOrEqual(before.section.right - 1);
    expect(before.heading.x).toBeGreaterThanOrEqual(before.menuHead.x + 8);
    expect(before.heading.right).toBeLessThanOrEqual(before.menuHead.right - 8);
    expect(before.brandContext.x).toBeGreaterThanOrEqual(before.menuHead.x + 8);
    expect(before.brandContext.right).toBeLessThanOrEqual(before.menuHead.right - 8);
    expect(before.menuHeadStyle.maxHeight).toBe('100px');
    expect(before.menuHeadStyle.overflow).toBe('visible');
    expect(before.search.height).toBe(40);
    expect(before.subchipHeight).toBe(40);
    expect(before.addButton.width).toBeGreaterThanOrEqual(before.addRow.width - 1);
    expect(before.activeSubchipColor).toBe('rgb(192, 59, 42)');
    expect(before.card.width).toBeGreaterThan(200);
    expect(before.media.height).toBe(180);
    expect(before.brandMark).not.toBeNull();
    expect(before.brandTitleDisplay).not.toBe('none');
    expect(before.brandSubDisplay).toBe('none');
    expect(before.search).not.toBeNull();
    expect(before.searchLabel.width).toBeLessThanOrEqual(1);
    expect(before.searchLabel.height).toBeLessThanOrEqual(1);
    expect(before.searchInput).not.toBeNull();
    expect(before.card.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth + 1);

    await waitForDeferredTheme(page);
    const after = await measure();
    const imagePriorities = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#deliveryGrid > .card[data-product-id]'));
      const firstTop = cards.length ? cards[0].getBoundingClientRect().top : 0;
      const firstRowImages = cards.filter((card) =>
        Math.abs(card.getBoundingClientRect().top - firstTop) <= 1
      ).map((card) => card.querySelector('.media img[src]')).filter(Boolean);
      return {
        firstRow: firstRowImages.length,
        eager: document.querySelectorAll('#deliveryGrid img[loading="eager"]').length,
        high: document.querySelectorAll('#deliveryGrid img[fetchpriority="high"]').length
      };
    });
    expect(imagePriorities.firstRow).toBeGreaterThan(0);
    expect(imagePriorities.eager).toBe(imagePriorities.firstRow);
    expect(imagePriorities.high).toBe(1);
    console.log('[slow-network-layout] after deferred CSS image priorities', JSON.stringify(imagePriorities));
    console.log('[slow-network-layout] after deferred CSS', JSON.stringify(after));
    expect(after.card.width).toBe(before.card.width);
    expect(after.media.height).toBe(before.media.height);
    expect(after.brandMark).toEqual(before.brandMark);
    expect(after.brandTitleDisplay).toBe(before.brandTitleDisplay);
    expect(after.brandSubDisplay).toBe(before.brandSubDisplay);
    expect(after.search).toEqual(before.search);
    expect(after.searchLabel).toEqual(before.searchLabel);
    expect(after.searchInput).toEqual(before.searchInput);
    expect(after.updated.width).toBe(0);
    expect(after.updated.height).toBe(0);
    expect(after.subchip.width).toBe(before.subchip.width);
    expect(after.option.height).toBe(before.option.height);
    expect(after.heading.width).toBeGreaterThan(60);
    expect(after.brandContext).not.toBeNull();
    expect(after.brandContext.width).toBeGreaterThan(0);
    expect(after.menuHead).toEqual(before.menuHead);
    expect(after.menuHead.height).toBe(100);
    expect(after.menuHeadStyle.overflow).not.toBe('hidden');
    expect(after.search.height).toBe(40);
    expect(after.subchipHeight).toBe(40);
    expect(after.subchipHeight).toBe(before.subchipHeight);
    expect(after.addButton).toEqual(before.addButton);
    expect(after.addRow).toEqual(before.addRow);
    expect(after.activeSubchipColor).toBe('rgb(192, 59, 42)');
    expect(after.menuHead.x).toBeLessThanOrEqual(after.rail.x + 1);
    expect(after.menuHead.right).toBeGreaterThanOrEqual(after.section.right - 1);
    expect(after.heading.x).toBeGreaterThanOrEqual(after.menuHead.x + 8);
    expect(after.heading.right).toBeLessThanOrEqual(after.menuHead.right - 8);
    expect(after.brandContext.x).toBeGreaterThanOrEqual(after.menuHead.x + 8);
    expect(after.brandContext.right).toBeLessThanOrEqual(after.menuHead.right - 8);
    expect(after.section.width).toBe(before.section.width);

    const shiftReport = await page.evaluate(() => ({
      cls: window.__layoutShifts.reduce((sum, value) => sum + value, 0),
      shifts: window.__layoutShiftDetails
    }));
    console.log('[slow-network-layout] layout shift attribution', JSON.stringify(shiftReport));
    const cls = shiftReport.cls;
    expect(cls).toBeLessThan(0.01);

  });

  test('delivery header stays stable at responsive breakpoints', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await routeImageDeliveryFixture(page);
    let themeCssGate = Promise.resolve();
    let heldThemeCssRequests = 0;
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      heldThemeCssRequests += 1;
      await themeCssGate;
      await route.continue();
    });

    for (const width of [320, 390, 480, 519, 520, 690, 691, 820, 821, 1023, 1024, 1180, 1181, 1599, 1600]) {
      let releaseThemeCss;
      themeCssGate = new Promise((resolve) => { releaseThemeCss = resolve; });
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/?brand=delivery', { waitUntil: 'commit' });
      await expect(page.locator('#deliveryGrid > .card[data-product-id]').first()).toBeAttached({ timeout: 10000 });
      await page.waitForFunction(() =>
        Array.isArray(window.DMENU) &&
        window.DMENU.length === 6 &&
        document.querySelectorAll('#deliveryGrid > .card[data-product-id]').length === 6
      );
      const expectedGridColumns = width >= 1600 ? 4 : width >= 1181 ? 3 : width >= 520 ? 2 : 1;
      await page.waitForFunction((expectedColumns) => {
        const cards = Array.from(document.querySelectorAll('#deliveryGrid > .card[data-product-id]'));
        if (cards.length !== 6) return false;
        const firstTop = cards[0].getBoundingClientRect().top;
        const firstRow = cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstTop) <= 1);
        const firstRowImages = firstRow.map((card) => card.querySelector('.media img[src]'));
        return firstRow.length === expectedColumns &&
          firstRowImages.every((image) => image && image.getAttribute('loading') === 'eager') &&
          document.querySelectorAll('#deliveryGrid img[fetchpriority="high"]').length === 1;
      }, expectedGridColumns, { timeout: 10000 });
      await expect.poll(() => heldThemeCssRequests, {
        message: 'theme CSS requests should be held before the pre-CSS layout measurement',
        timeout: 10000
      }).toBeGreaterThan(0);

      const measureBrand = () => page.evaluate(() => {
        const mark = document.querySelector('#brandMark');
        const rect = mark && mark.getBoundingClientRect();
        const header = document.querySelector('header.topbar');
        const brand = document.querySelector('#headerBrand');
        const headerRect = header && header.getBoundingClientRect();
        const headerStyle = header && getComputedStyle(header);
        const brandStyle = brand && getComputedStyle(brand);
        const cards = Array.from(document.querySelectorAll('#deliveryGrid > .card[data-product-id]'));
        const firstRowTop = cards.length ? cards[0].getBoundingClientRect().top : 0;
        const firstRowImageCount = cards.filter((card) =>
          Math.abs(card.getBoundingClientRect().top - firstRowTop) <= 1 &&
          !!card.querySelector('.media img[src]')
        ).length;
        return {
          x: rect ? Math.round(rect.x) : null,
          y: rect ? Math.round(rect.y) : null,
          width: rect ? Math.round(rect.width) : null,
          height: rect ? Math.round(rect.height) : null,
          headerY: headerRect ? Math.round(headerRect.y) : null,
          headerHeight: headerRect ? Math.round(headerRect.height) : null,
          headerPaddingTop: headerStyle && headerStyle.paddingTop,
          headerPaddingBottom: headerStyle && headerStyle.paddingBottom,
          headerMinHeight: headerStyle && headerStyle.minHeight,
          brandHeight: brandStyle && brandStyle.height,
          brandMinHeight: brandStyle && brandStyle.minHeight,
          brandAlignSelf: brandStyle && brandStyle.alignSelf,
          brandDisplay: brandStyle && brandStyle.display,
          brandGap: brandStyle && brandStyle.gap,
          brandRect: brand ? (() => {
            const box = brand.getBoundingClientRect();
            return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
          })() : null,
          titleDisplay: getComputedStyle(document.querySelector('#brandTitle')).display,
          subDisplay: getComputedStyle(document.querySelector('#brandSub')).display,
          gridColumns: getComputedStyle(document.querySelector('#deliveryGrid')).gridTemplateColumns.trim().split(/\s+/).length,
          firstRowImageCount,
          eagerImageCount: document.querySelectorAll('#deliveryGrid img[loading="eager"]').length,
          highPriorityImageCount: document.querySelectorAll('#deliveryGrid img[fetchpriority="high"]').length,
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        };
      });

      const before = await measureBrand();
      console.log(`[slow-network-layout] ${width}px before CSS`, JSON.stringify(before));
      expect(before.width, `brand mark exists at ${width}px`).not.toBeNull();
      expect(before.gridColumns, `delivery grid has ${expectedGridColumns} columns at ${width}px before CSS`)
        .toBe(expectedGridColumns);
      expect(before.eagerImageCount, `all and only first-row images are eager at ${width}px`)
        .toBe(before.firstRowImageCount);
      expect(before.highPriorityImageCount, `only the first-row LCP image has high priority at ${width}px`)
        .toBe(before.firstRowImageCount ? 1 : 0);
      expect(before.titleDisplay, `delivery brand title remains visible at ${width}px before CSS`).not.toBe('none');
      if (width < 820) {
        expect(before.subDisplay, `delivery brand subtitle stays hidden on compact mobile at ${width}px before CSS`).toBe('none');
      } else {
        expect(before.subDisplay, `delivery brand descriptor is absent for coffee-only markup at ${width}px before CSS`).toBe('none');
      }
      expect(before.scrollWidth, `no initial horizontal overflow at ${width}px`)
        .toBeLessThanOrEqual(width + 1);

      releaseThemeCss();
      await waitForDeferredTheme(page);
      const after = await measureBrand();
      console.log(`[slow-network-layout] ${width}px after CSS`, JSON.stringify(after));
      expect(after.subDisplay, `brand subtitle display remains stable at ${width}px`).toBe(before.subDisplay);
      expect(after.brandDisplay, `brand container display remains stable at ${width}px`).toBe(before.brandDisplay);
      expect(after.brandGap, `brand container gap remains stable at ${width}px`).toBe(before.brandGap);
      expect(Math.abs(after.brandRect.x - before.brandRect.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.brandRect.width - before.brandRect.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.brandRect.height - before.brandRect.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.brandRect.y - before.brandRect.y)).toBeLessThanOrEqual(1);
      expect(after.x, `brand x remains stable at ${width}px`).toBe(before.x);
      expect(Math.abs(after.y - before.y), `brand y remains stable within 1px at ${width}px`)
        .toBeLessThanOrEqual(1);
      expect(after.width, `brand width remains stable at ${width}px`).toBe(before.width);
      expect(Math.abs(after.height - before.height), `brand height remains stable within 1px at ${width}px`).toBeLessThanOrEqual(1);
      expect(after.gridColumns, `delivery grid keeps its responsive column count at ${width}px after CSS`)
        .toBe(expectedGridColumns);
      expect(after.eagerImageCount, `all and only first-row images stay eager at ${width}px after CSS`)
        .toBe(after.firstRowImageCount);
      expect(after.highPriorityImageCount, `one first-row LCP image stays high priority at ${width}px after CSS`)
        .toBe(after.firstRowImageCount ? 1 : 0);
      expect(after.scrollWidth, `no final horizontal overflow at ${width}px`)
        .toBeLessThanOrEqual(width + 1);

      if (testInfo.project.name === 'chromium' && [320, 390, 520, 690, 820, 821, 1024, 1181, 1600].includes(width)) {
        await testInfo.attach(`delivery-${width}px`, {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
          contentType: 'image/png'
        });
      }
    }
  });

  test('delivery first frame loads schedule without coffee catalog, chat or orders', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    // Keep this request/checkout test independent of the production menu's
    // current assortment; a pizza with required options cannot be added yet.
    await page.route('**/dmenu**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'first-frame-cart-fixture',
          name: 'Cart fixture',
          desc: '',
          cat: 'pizza',
          section: 'delivery',
          price: 500,
          on: 1,
          opts: [],
          comp: [],
          e: '🍕'
        }]
      })
    }));

    const requested = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (/^\/api\/(menu|menu\/all|dmenu|delivery\/info|chat\/thread|orders\/mine)$/.test(pathname)) {
        requested.push(pathname);
      }
    });

    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await expect(page.locator('#deliveryGrid > .card[data-product-id]').first()).toBeAttached({ timeout: 10000 });

    expect(requested.filter((path) => path === '/api/dmenu')).toHaveLength(1);
    expect(requested).not.toContain('/api/menu');
    expect(requested).not.toContain('/api/menu/all');
    expect(requested).not.toContain('/api/chat/thread');
    expect(requested).not.toContain('/api/orders/mine');
    await expect.poll(() => requested.filter((path) => path === '/api/delivery/info').length)
      .toBe(1);

    await page.locator('#deliveryGrid .cta[data-add]').first().click();
    await expect(page.locator('#cartFab')).toBeVisible();
    await page.click('#cartFab');
    await expect.poll(() => requested.filter((path) => path === '/api/delivery/info').length)
      .toBeGreaterThanOrEqual(1);
    await expect(page.locator('#checkoutBtn')).toBeEnabled();
  });

  test('switching from delivery lazily loads the coffee catalog', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await expect(page.locator('#deliveryGrid > .card[data-product-id]').first()).toBeAttached({ timeout: 10000 });
    await page.waitForFunction(() => Array.isArray(window.DMENU) && window.DMENU.length > 0);
    await page.waitForFunction(() => typeof window.__ensureVenueToggle === 'function');
    expect(await page.evaluate(() => window.MENU.length)).toBe(0);

    const venueToggle = page.locator('#venueToggle');
    await expect(venueToggle).toBeVisible();
    await venueToggle.click();
    const coffeeButton = page.locator('#brandSeg [data-brand="coffee"]');
    await expect(coffeeButton).toBeVisible();

    const coffeeResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/api/menu' &&
      response.request().method() === 'GET'
    );
    await coffeeButton.click();
    const response = await coffeeResponse;
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.items.length).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.MENU.length)).toBeGreaterThan(0);
    await expect(page.locator('#grid > .card').first()).toBeAttached();
  });

  test('delivery image priorities follow the actual first grid row after viewport resizing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await routeImageDeliveryFixture(page);
    const deliveryResponse = page.waitForResponse((res) =>
      new URL(res.url()).pathname.replace(/\/+$/, '').endsWith('/dmenu'), { timeout: 5000 }
    );
    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    const response = await deliveryResponse;
    expect(response.ok()).toBeTruthy();
    const items = (await response.json()).items;
    expect(items).toHaveLength(6);
    expect(items[0].id).toBe('responsive-image-0');
    await expect(page.locator('#deliveryGrid > .card[data-product-id] img[src]').first()).toBeAttached({ timeout: 10000 });
    await expect.poll(() => page.locator('#deliveryGrid > .card[data-product-id]').count()).toBe(6);
    expect(await page.locator('#deliveryGrid > .card[data-product-id]').nth(4).evaluate((card) =>
      getComputedStyle(card).contentVisibility
    )).toBe('auto');

    for (const width of [320, 520, 1181, 1600, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const isCorrect = () => page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#deliveryGrid > .card[data-product-id]'));
        const firstTop = cards.length ? cards[0].getBoundingClientRect().top : 0;
        const firstRowImages = cards.filter((card) =>
          Math.abs(card.getBoundingClientRect().top - firstTop) <= 1
        ).map((card) => card.querySelector('.media img[src]')).filter(Boolean);
        const eager = document.querySelectorAll('#deliveryGrid img[loading="eager"]').length;
        const high = document.querySelectorAll('#deliveryGrid img[fetchpriority="high"]').length;
        return {
          imageCount: firstRowImages.length,
          eager,
          high,
          correct: firstRowImages.length > 0 &&
            eager === firstRowImages.length &&
            high === 1
        };
      });
      await expect.poll(async () => (await isCorrect()).correct, {
        message: `non-empty first-row images keep eager/high priority at ${width}px`
      }).toBe(true);
    }
  });

  test('initial-card-preservation branch keeps the first image and reapplies row priorities', async ({ page }) => {
    await page.route(/\/media\/dishes\/.*$/, (route) => route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
    }));
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await page.waitForFunction(() =>
      typeof window.renderDeliveryMenu === 'function' &&
      Array.isArray(window.DMENU) &&
      window.DMENU.length > 0
    );

    const result = await page.evaluate(() => {
      window.dcat = 'pizza';
      const firstItem = window.DMENU.find((item) => item.cat === window.dcat);
      if (!firstItem) return { preservable: false };
      firstItem.img = '/media/dishes/pz-marg-card.webp';
      window.renderDeliveryMenu();

      const grid = document.getElementById('deliveryGrid');
      const firstCard = grid && grid.querySelector(':scope > .card[data-product-id]');
      const firstImage = firstCard && firstCard.querySelector('.media img[src]');
      if (!firstCard || !firstItem || !firstImage || firstImage.getAttribute('src') !== firstItem.img) {
        return { preservable: false };
      }

      firstImage.setAttribute('data-preservation-probe', 'kept');
      window.renderDeliveryMenu();
      const retainedCard = grid.querySelector(':scope > .card[data-product-id]');
      const retainedImage = retainedCard && retainedCard.querySelector('.media img[src]');
      const cards = Array.from(grid.querySelectorAll(':scope > .card[data-product-id]'));
      const firstTop = cards.length ? cards[0].getBoundingClientRect().top : 0;
      const firstRowImages = cards.filter((card) =>
        Math.abs(card.getBoundingClientRect().top - firstTop) <= 1
      ).map((card) => card.querySelector('.media img[src]')).filter(Boolean);
      return {
        preservable: true,
        sameCard: retainedCard === firstCard,
        sameImage: retainedImage === firstImage,
        imageMarker: retainedImage && retainedImage.getAttribute('data-preservation-probe'),
        eager: grid.querySelectorAll('img[loading="eager"]').length,
        high: grid.querySelectorAll('img[fetchpriority="high"]').length,
        firstRow: firstRowImages.length
      };
    });
    expect(result.preservable).toBe(true);
    expect(result.sameCard).toBe(true);
    expect(result.sameImage).toBe(true);
    expect(result.imageMarker).toBe('kept');
    expect(result.eager).toBe(result.firstRow);
    expect(result.high).toBe(result.firstRow ? 1 : 0);
  });

  test('coffee header controls stay separated before and after deferred CSS on mobile', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    for (const width of [320, 390, 520, 690]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/?brand=coffee', { waitUntil: 'commit' });
      await expect(page.locator('.venueWrap')).toBeAttached();
      await expect(page.locator('#brandMark')).toBeAttached();

      const measureHeader = () => page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || !box.width || !box.height) return null;
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        };
        const topbar = document.querySelector('header.topbar');
        const topbarRect = topbar && topbar.getBoundingClientRect();
        const topbarStyle = topbar && getComputedStyle(topbar);
        const venueWrap = document.querySelector('.venueWrap');
        const venueStyle = venueWrap && getComputedStyle(venueWrap);
        const ticker = document.querySelector('.ticker');
        const tickerRect = ticker && ticker.getBoundingClientRect();
        const controls = ['.venueWrap', '#headerBrand', '#profileTopBtn']
          .map((selector) => document.querySelector(selector))
          .filter(Boolean)
          .map((element) => element.getBoundingClientRect());
        const groupLeft = Math.min(...controls.map((box) => box.left));
        const groupRight = Math.max(...controls.map((box) => box.right));
        const verticalCenters = controls.map((box) => box.top + box.height / 2);
        return {
          venue: rect('.venueWrap'),
          brandMark: rect('#brandMark'),
          brandTitle: rect('#brandTitle'),
          brandGroup: rect('#headerBrand'),
          profile: rect('#profileTopBtn'),
          groupCenter: (groupLeft + groupRight) / 2,
          controlCenterSpread: Math.max(...verticalCenters) - Math.min(...verticalCenters),
          ticker: tickerRect ? {
            top: tickerRect.top,
            left: tickerRect.left,
            width: tickerRect.width,
            parentIsBody: ticker.parentElement === document.body
          } : null,
          headerShadow: topbarStyle.boxShadow,
          bonus: rect('#mbonusBtn'),
          bonusStyle: (() => {
            const bonus = document.querySelector('#mbonusBtn');
            if (!bonus) return null;
            const style = getComputedStyle(bonus);
            return {
              position: style.position,
              width: style.width,
              height: style.height,
              left: style.left,
              bottom: style.bottom
            };
          })(),
          topbar: topbarRect ? {
            y: topbarRect.y,
            height: topbarRect.height,
            paddingTop: topbarStyle.paddingTop,
            paddingBottom: topbarStyle.paddingBottom,
            alignItems: topbarStyle.alignItems,
            alignContent: topbarStyle.alignContent,
            gridTemplateRows: topbarStyle.gridTemplateRows
          } : null,
          venueStyle: venueStyle ? {
            marginTop: venueStyle.marginTop,
            alignSelf: venueStyle.alignSelf,
            position: venueStyle.position,
            transform: venueStyle.transform
          } : null,
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        };
      });

      const assertHeader = (header, phase) => {
        for (const selector of ['venue', 'brandMark', 'brandTitle', 'profile', 'bonus']) {
          expect(header[selector], `${selector} is visible at ${width}px ${phase}`).not.toBeNull();
        }
        expect(header.bonusStyle.position, `bonus stays fixed at ${width}px ${phase}`).toBe('fixed');
        expect(header.bonusStyle.width, `bonus width is reserved at ${width}px ${phase}`).toBe('56px');
        expect(header.bonusStyle.height, `bonus height is reserved at ${width}px ${phase}`).toBe('56px');
        const controls = ['venue', 'brandGroup', 'profile']
          .map((selector) => header[selector]);
        for (let i = 0; i < controls.length; i++) {
          for (let j = i + 1; j < controls.length; j++) {
            const overlaps = controls[i].left < controls[j].right &&
              controls[i].right > controls[j].left &&
              controls[i].top < controls[j].bottom &&
              controls[i].bottom > controls[j].top;
            expect(overlaps, `visible header controls do not overlap at ${width}px ${phase}: ${JSON.stringify(header)}`).toBe(false);
          }
        }
        expect(header.scrollWidth, `no horizontal overflow at ${width}px ${phase}`)
          .toBeLessThanOrEqual(header.viewportWidth + 1);
        expect(Math.abs(header.groupCenter - width / 2), `header controls are one centered row at ${width}px ${phase}`)
          .toBeLessThanOrEqual(1.5);
        expect(header.controlCenterSpread, `header controls share one vertical center at ${width}px ${phase}`)
          .toBeLessThanOrEqual(2);
        expect(header.topbar.height, `guest header stays compact at ${width}px ${phase}`)
          .toBeLessThanOrEqual(64);
        expect(header.headerShadow, `header has no lower shadow at ${width}px ${phase}`).toBe('none');
        expect(header.ticker.parentIsBody, `ticker is outside the header at ${width}px ${phase}`).toBe(true);
        expect(Math.abs(header.ticker.top - (header.topbar.y + header.topbar.height)),
          `ticker touches header with no gap at ${width}px ${phase}`).toBeLessThanOrEqual(1);
        expect(Math.abs(header.ticker.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(header.ticker.width - width)).toBeLessThanOrEqual(1);
      };

      const before = await measureHeader();
      console.log(`[slow-network-layout] coffee ${width}px before CSS`, JSON.stringify(before));
      assertHeader(before, 'before CSS');

      await waitForDeferredTheme(page);
      const after = await measureHeader();
      console.log(`[slow-network-layout] coffee ${width}px after CSS`, JSON.stringify(after));
      assertHeader(after, 'after CSS');

      expect(after.bonus).toEqual(before.bonus);
      expect(after.bonusStyle).toEqual(before.bonusStyle);
      for (const selector of ['venue', 'brandGroup', 'profile']) {
        for (const edge of ['left', 'right', 'top', 'bottom']) {
          expect(Math.abs(after[selector][edge] - before[selector][edge]),
            `${selector} ${edge} stays stable at ${width}px after deferred CSS`)
            .toBeLessThanOrEqual(1);
        }
      }

      if (testInfo.project.name === 'chromium') {
        await testInfo.attach(`coffee-header-${width}px`, {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
          contentType: 'image/png'
        });
      }
    }
  });

  test('cached staff role keeps delivery header and editor bar stable during auth hydration', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'staff-layout-test-token');
      localStorage.setItem('zt_role', 'admin');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
      window.__layoutShifts = [];
      try {
        window.__layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            const sources = Array.from(entry.sources || []).slice(0, 5).map((source) => {
              const node = source.node;
              const rect = (value) => value && ({
                x: value.x, y: value.y, width: value.width, height: value.height
              });
              return {
                node: node ? {
                  tag: String(node.tagName || node.nodeName || '').toLowerCase(),
                  id: node.id || '',
                  className: typeof node.className === 'string' ? node.className : ''
                } : null,
                previousRect: rect(source.previousRect),
                currentRect: rect(source.currentRect)
              };
            });
            window.__layoutShifts.push({
              value: entry.value,
              startTime: Math.round(entry.startTime * 100) / 100,
              sources
            });
          }
        });
        window.__layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
    });

    const deliveryItems = Array.from({ length: 6 }, (_, index) => ({
      id: 990001 + index,
      name: 'Тестовая пицца ' + (index + 1),
      desc: 'Красный соус, моцарелла',
      cat: 'pizza',
      section: 'delivery',
      price: 535,
      on: 1,
      opts: [
        { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
        { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
        { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
        { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 }
      ],
      comp: ['красный соус', 'моцарелла'],
      e: '🍕',
      img: '/media/dishes/1-card.webp'
    }));

    await page.route(/\/media\/dishes\/.*$/, (route) => route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
    }));
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/me') {
        await new Promise((resolve) => setTimeout(resolve, 9000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            customer: {
              id: 900001,
              name: 'Layout Test Admin',
              phone: '+70000000000',
              role: 'admin',
              stamps: 0,
              free: 0,
              cups: 0,
              qr: 'layout-test',
              verified: 1,
              welcome: 1,
              tg: 0,
              notify_tg: 1,
              notify_web: 1,
              history: []
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          items: deliveryItems,
          orders: [],
          pending: [],
          customers: [],
          threads: [],
          messages: [],
          promos: [],
          today: { open: 11, close: 22 },
          schedule: { open: 11, close: 22 },
          days: []
        })
      });
    });

    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    const meRequest = page.waitForRequest((request) => request.url().endsWith('/api/me'), { timeout: 15000 });
    const publicMenuResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/api/dmenu'
    , { timeout: 15000 });
    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await page.locator('#modeSeg').waitFor({ state: 'attached' });
    await Promise.all([meRequest, publicMenuResponse]);
    await waitForDeferredTheme(page);

    const before = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: box.top,
          height: box.height,
          display: style.display,
          visibility: style.visibility,
          hidden: element.hidden
        };
      };
      const header = document.querySelector('header.topbar');
      const modeSeg = document.querySelector('#modeSeg');
      return {
        role: document.documentElement.getAttribute('data-staff-role'),
        ready: document.documentElement.hasAttribute('data-staff-ready'),
        bodyClass: document.body.className,
        header: rect('header.topbar'),
        headerStyle: header && {
          height: getComputedStyle(header).height,
          minHeight: getComputedStyle(header).minHeight,
          paddingTop: getComputedStyle(header).paddingTop,
          paddingBottom: getComputedStyle(header).paddingBottom,
          gridTemplateRows: getComputedStyle(header).gridTemplateRows
        },
        modeSeg: Object.assign(rect('#modeSeg') || {}, {
          parentClass: modeSeg && modeSeg.parentElement && modeSeg.parentElement.className
        }),
        modeSlot: rect('.menu-controls-row .mode-seg-slot'),
        menuRow: rect('.menu-controls-row'),
        menuHead: rect('.menu-head'),
        modeSegStyle: modeSeg && {
          marginTop: getComputedStyle(modeSeg).marginTop,
          height: getComputedStyle(modeSeg).height,
          minHeight: getComputedStyle(modeSeg).minHeight,
          alignSelf: getComputedStyle(modeSeg).alignSelf
        },
        wrap: rect('body > .wrap'),
        adminBar: rect('#adminBar')
      };
    });

    console.log('[staff-layout] before auth hydration', JSON.stringify(before));
    expect(before.role).toBe('admin');
    expect(before.ready).toBe(false);
    expect(before.modeSeg.hidden).toBe(true);
    expect(before.modeSeg.display).toBe('none');
    expect(before.adminBar.hidden).toBe(true);
    expect(before.adminBar.display).toBe('none');
    expect(before.adminBar.visibility).toBe('hidden');
    expect(before.adminBar.height).toBe(0);

    // The first-paint/CSS/font settle is asserted by the neighboring layout tests.
    // Drain those earlier entries so this threshold measures only the delayed auth interval.
    await page.evaluate(() => {
      if (window.__layoutShiftObserver) window.__layoutShiftObserver.takeRecords();
      window.__layoutShifts.length = 0;
    });

    const meResponse = await page.waitForResponse((response) => response.url().endsWith('/api/me'), { timeout: 15000 });
    expect(meResponse.ok()).toBe(true);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-staff-ready'), null, { timeout: 10000 });
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: box.top,
          height: box.height,
          display: style.display,
          visibility: style.visibility,
          hidden: element.hidden
        };
      };
      const header = document.querySelector('header.topbar');
      const modeSeg = document.querySelector('#modeSeg');
      return {
        role: document.documentElement.getAttribute('data-staff-role'),
        ready: document.documentElement.hasAttribute('data-staff-ready'),
        bodyClass: document.body.className,
        header: rect('header.topbar'),
        headerStyle: header && {
          height: getComputedStyle(header).height,
          minHeight: getComputedStyle(header).minHeight,
          paddingTop: getComputedStyle(header).paddingTop,
          paddingBottom: getComputedStyle(header).paddingBottom,
          gridTemplateRows: getComputedStyle(header).gridTemplateRows
        },
        modeSeg: Object.assign(rect('#modeSeg') || {}, {
          parentClass: modeSeg && modeSeg.parentElement && modeSeg.parentElement.className
        }),
        modeSlot: rect('.menu-controls-row .mode-seg-slot'),
        menuRow: rect('.menu-controls-row'),
        menuHead: rect('.menu-head'),
        modeSegStyle: modeSeg && {
          marginTop: getComputedStyle(modeSeg).marginTop,
          height: getComputedStyle(modeSeg).height,
          minHeight: getComputedStyle(modeSeg).minHeight,
          alignSelf: getComputedStyle(modeSeg).alignSelf
        },
        wrap: rect('body > .wrap'),
        adminBar: rect('#adminBar'),
        cls: window.__layoutShifts.reduce((sum, entry) => sum + entry.value, 0),
        shiftCount: window.__layoutShifts.length,
        layoutShifts: window.__layoutShifts.slice(-20)
      };
    });

    console.log('[staff-layout] after auth hydration', JSON.stringify(after));
    expect(after.ready).toBe(true);
    expect(after.role).toBe('admin');
    expect(after.modeSeg.hidden).toBe(false);
    expect(after.modeSeg.visibility).toBe('visible');
    expect(after.adminBar.hidden).toBe(true);
    expect(after.adminBar.display).toBe('none');
    expect(after.adminBar.visibility).toBe('visible');
    expect(after.headerStyle.gridTemplateRows).toBe(before.headerStyle.gridTemplateRows);
    expect(Math.abs(after.header.height - before.header.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.wrap.top - before.wrap.top)).toBeLessThanOrEqual(1);
    // Reserve the final role row geometry while the cached role is still being confirmed.
    // Revealing the switcher must not resize its slot or the two-row title toolbar.
    expect(after.modeSeg.height).toBe(32);
    expect(after.modeSeg.parentClass).toBe('mode-seg-slot');
    expect(after.modeSlot.height).toBe(32);
    expect(after.menuRow.height).toBe(36);
    expect(after.menuHead.height).toBe(100);
    expect(before.modeSlot.height).toBe(32);
    expect(after.modeSlot.height).toBe(32);
    expect(before.menuRow.height).toBe(36);
    expect(after.menuRow.height).toBe(36);
    expect(after.modeSeg.top).toBeGreaterThanOrEqual(after.menuRow.top - 1);
    expect(after.modeSeg.top + after.modeSeg.height).toBeLessThanOrEqual(after.menuRow.top + after.menuRow.height + 1);
    expect(after.adminBar.height).toBe(before.adminBar.height);
    expect(after.cls).toBeLessThan(0.01);
  });

  test('staff layout reservation is released when the main bundle never starts', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'blocked-bundle-test-token');
      localStorage.setItem('zt_role', 'admin');
    });
    await page.route('**/dist/main.bundle.js*', (route) => route.abort());
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

    await expect.poll(() => page.evaluate(() =>
      document.documentElement.getAttribute('data-staff-role')
    )).toBe('admin');
    expect(await page.evaluate(() =>
      document.documentElement.hasAttribute('data-staff-ready')
    )).toBe(false);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.getAttribute('data-staff-role')
    ), { timeout: 10000, intervals: [250, 500, 1000] }).toBeNull();
  });

});


test.describe('API request cancellation', () => {
  test.use({ serviceWorkers: 'block' });

  test('api forwards AbortSignal to fetch', async ({ page }) => {
    await page.route('**/api/__abort-signal-probe', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true })
        });
      } catch (_) {
        // The test intentionally aborts this request before the response is sent.
      }
    });

    await page.goto('/?brand=coffee');
    await expect.poll(() => page.evaluate(() => typeof window.api)).toBe('function');

    const result = await page.evaluate(async () => {
      const controller = new AbortController();
      const request = window.api('/__abort-signal-probe', { signal: controller.signal });
      setTimeout(() => controller.abort(), 20);
      try {
        await request;
        return 'resolved';
      } catch (error) {
        return error.name;
      }
    });

    expect(result).toBe('AbortError');
  });
});
