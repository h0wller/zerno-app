import { test, expect } from '@playwright/test';

async function waitForDeferredTheme(page) {
  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => link.href.includes('/app/ui/theme/'));
    return links.length > 0 && links.every((link) => !!link.sheet);
  }, null, { timeout: 15000 });
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

    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
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
      const heading = document.querySelector('#deliveryView .menu-head h1');
      const card = document.querySelector('#deliveryGrid > .card');
      const media = card && card.querySelector('.media');
      const brandTitle = document.querySelector('#brandTitle');
      const brandSub = document.querySelector('#brandSub');
      return {
        ticker: box(ticker),
        tickerOverflow: ticker && getComputedStyle(ticker).overflow,
        heading: box(heading),
        card: box(card),
        media: box(media),
        brandMark: box(document.querySelector('#brandMark')),
        brandTitleDisplay: brandTitle && getComputedStyle(brandTitle).display,
        brandSubDisplay: brandSub && getComputedStyle(brandSub).display,
        search: box(document.querySelector('#deliveryView .mh-right .search')),
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
    expect(before.ticker.height).toBeLessThanOrEqual(30);
    expect(before.tickerOverflow).toBe('hidden');
    expect(before.section.width).toBeGreaterThan(250);
    expect(before.section.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.heading.width).toBeGreaterThan(200);
    expect(before.heading.x).toBeGreaterThanOrEqual(before.section.x);
    expect(before.heading.right).toBeLessThanOrEqual(before.section.right + 1);
    expect(before.card.width).toBeGreaterThan(200);
    expect(before.media.height).toBe(180);
    expect(before.brandMark).not.toBeNull();
    expect(before.brandTitleDisplay).toBe('none');
    expect(before.brandSubDisplay).toBe('none');
    expect(before.search).not.toBeNull();
    expect(before.searchInput).not.toBeNull();
    expect(before.card.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth + 1);

    await waitForDeferredTheme(page);
    const after = await measure();
    console.log('[slow-network-layout] after deferred CSS', JSON.stringify(after));
    expect(after.card.width).toBe(before.card.width);
    expect(after.media.height).toBe(before.media.height);
    expect(after.brandMark).toEqual(before.brandMark);
    expect(after.brandTitleDisplay).toBe(before.brandTitleDisplay);
    expect(after.brandSubDisplay).toBe(before.brandSubDisplay);
    expect(after.search).toEqual(before.search);
    expect(after.searchInput).toEqual(before.searchInput);
    expect(after.updated.width).toBe(before.updated.width);
    expect(after.updated.height).toBe(before.updated.height);
    expect(after.subchip.width).toBe(before.subchip.width);
    expect(after.option.height).toBe(before.option.height);
    expect(after.heading.width).toBeGreaterThan(200);
    expect(after.heading.x).toBeGreaterThanOrEqual(after.section.x);
    expect(after.heading.right).toBeLessThanOrEqual(after.section.right + 1);
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
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    for (const width of [320, 390, 480, 519, 520, 690, 691, 820, 821, 1023, 1024, 1180, 1181, 1599, 1600]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/?brand=delivery', { waitUntil: 'commit' });
      await expect(page.locator('#deliveryGrid > .card[data-product-id]').first()).toBeAttached({ timeout: 10000 });

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
      const expectedGridColumns = width >= 1600 ? 4 : width >= 1181 ? 3 : width >= 520 ? 2 : 1;
      expect(before.gridColumns, `delivery grid has ${expectedGridColumns} columns at ${width}px before CSS`)
        .toBe(expectedGridColumns);
      expect(before.eagerImageCount, `all and only first-row images are eager at ${width}px`)
        .toBe(before.firstRowImageCount);
      expect(before.highPriorityImageCount, `only the first-row LCP image has high priority at ${width}px`)
        .toBe(before.firstRowImageCount ? 1 : 0);
      if (width <= 1023) {
        expect(before.titleDisplay, `coffee title hidden at ${width}px before CSS`).toBe('none');
        expect(before.subDisplay, `coffee subtitle hidden at ${width}px before CSS`).toBe('none');
      } else {
        expect(before.titleDisplay, `desktop brand title visible at ${width}px before CSS`).not.toBe('none');
        expect(before.subDisplay, `desktop brand subtitle visible at ${width}px before CSS`).not.toBe('none');
      }
      expect(before.scrollWidth, `no initial horizontal overflow at ${width}px`)
        .toBeLessThanOrEqual(width + 1);

      await waitForDeferredTheme(page);
      const after = await measureBrand();
      console.log(`[slow-network-layout] ${width}px after CSS`, JSON.stringify(after));
      expect(after.subDisplay, `brand subtitle display remains stable at ${width}px`).toBe(before.subDisplay);
      expect(after.brandDisplay, `brand container display remains stable at ${width}px`).toBe(before.brandDisplay);
      expect(after.brandGap, `brand container gap remains stable at ${width}px`).toBe(before.brandGap);
      expect(after.brandRect.x).toBe(before.brandRect.x);
      expect(after.brandRect.width).toBe(before.brandRect.width);
      expect(after.brandRect.height).toBe(before.brandRect.height);
      expect(Math.abs(after.brandRect.y - before.brandRect.y)).toBeLessThanOrEqual(1);
      expect(after.x, `brand x remains stable at ${width}px`).toBe(before.x);
      expect(Math.abs(after.y - before.y), `brand y remains stable within 1px at ${width}px`)
        .toBeLessThanOrEqual(1);
      expect(after.width, `brand width remains stable at ${width}px`).toBe(before.width);
      expect(after.height, `brand height remains stable at ${width}px`).toBe(before.height);
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

  test('delivery image priorities follow the actual first grid row after viewport resizing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await expect(page.locator('#deliveryGrid > .card[data-product-id]').first()).toBeAttached({ timeout: 10000 });

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
        return eager === firstRowImages.length && high === (firstRowImages.length ? 1 : 0);
      });
      await expect.poll(isCorrect, { message: `image priorities follow the first row at ${width}px` }).toBe(true);
    }
  });

  test('initial-card-preservation branch keeps the first image and reapplies row priorities', async ({ page }) => {
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
      window.renderDeliveryMenu();

      const grid = document.getElementById('deliveryGrid');
      const firstCard = grid && grid.querySelector(':scope > .card[data-product-id]');
      const firstItem = window.DMENU.find((item) => item.cat === window.dcat);
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
        return {
          venue: rect('.venueWrap'),
          brandMark: rect('#brandMark'),
          brandTitle: rect('#brandTitle'),
          profile: rect('#profileTopBtn'),
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        };
      });

      const assertHeader = (header, phase) => {
        for (const selector of ['venue', 'brandMark', 'brandTitle', 'profile']) {
          expect(header[selector], `${selector} is visible at ${width}px ${phase}`).not.toBeNull();
        }
        const controls = ['venue', 'brandMark', 'brandTitle', 'profile']
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
      };

      const before = await measureHeader();
      console.log(`[slow-network-layout] coffee ${width}px before CSS`, JSON.stringify(before));
      assertHeader(before, 'before CSS');

      await waitForDeferredTheme(page);
      const after = await measureHeader();
      console.log(`[slow-network-layout] coffee ${width}px after CSS`, JSON.stringify(after));
      assertHeader(after, 'after CSS');

      for (const selector of ['venue', 'brandMark', 'brandTitle', 'profile']) {
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
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
    });

    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/me') {
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
          items: [],
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
    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await page.locator('#modeSeg').waitFor({ state: 'attached' });
    await meRequest;
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
        modeSeg: rect('#modeSeg'),
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
    expect(before.modeSeg.display).toBe('flex');
    expect(before.modeSeg.visibility).toBe('hidden');
    expect(before.adminBar.hidden).toBe(true);
    expect(before.adminBar.display).toBe('grid');
    expect(before.adminBar.visibility).toBe('hidden');

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
        modeSeg: rect('#modeSeg'),
        modeSegStyle: modeSeg && {
          marginTop: getComputedStyle(modeSeg).marginTop,
          height: getComputedStyle(modeSeg).height,
          minHeight: getComputedStyle(modeSeg).minHeight,
          alignSelf: getComputedStyle(modeSeg).alignSelf
        },
        wrap: rect('body > .wrap'),
        adminBar: rect('#adminBar'),
        cls: window.__layoutShifts.reduce((sum, value) => sum + value, 0)
      };
    });

    console.log('[staff-layout] after auth hydration', JSON.stringify(after));
    expect(after.ready).toBe(true);
    expect(after.role).toBe('admin');
    expect(after.modeSeg.hidden).toBe(false);
    expect(after.modeSeg.visibility).toBe('visible');
    expect(after.adminBar.hidden).toBe(false);
    expect(after.adminBar.visibility).toBe('visible');
    expect(after.headerStyle.gridTemplateRows).toBe(before.headerStyle.gridTemplateRows);
    expect(Math.abs(after.header.height - before.header.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.wrap.top - before.wrap.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.modeSeg.top - before.modeSeg.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.modeSeg.height - before.modeSeg.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.adminBar.height - before.adminBar.height)).toBeLessThanOrEqual(1);
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
