import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function mockStaffSession(page, role = 'admin') {
  await page.addInitScript((staffRole) => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'playwright-staff-layout-token');
    localStorage.setItem('zt_role', staffRole);
    sessionStorage.setItem('splashDone', '1');
  }, role);
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const customer = {
      id: 'staff-layout-test',
      name: 'Staff Layout Test',
      phone: '+70000000000',
      role,
      verified: 1,
      cups: 0,
      stamps: 0,
      free: 0,
      history: [],
      qr: 'staff-layout-test'
    };
    const body = pathname === '/api/me'
      ? { customer }
      : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}

test('single staff action does not stretch the admin bar across the content column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready') &&
    typeof window.syncBrandViews === 'function'
  );
  await page.evaluate(() => window.setMode('admin'));
  const bar = page.locator('#adminBar');
  await expect(bar).toBeVisible();
  await page.evaluate(() => {
    const element = document.getElementById('adminBar');
    element.querySelectorAll('button').forEach((button, index) => { button.hidden = index > 0; });
  });
  const dimensions = await bar.evaluate((element) => ({
    parentWidth: element.getBoundingClientRect().width,
    buttonWidth: element.querySelector('button:not([hidden])').getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.parentWidth).toBeLessThanOrEqual(240);
  expect(dimensions.buttonWidth).toBeLessThanOrEqual(220);
  expect(dimensions.parentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('staff switcher is in the menu row for guest mode and returns to the topbar in staff modes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready') &&
    typeof window.syncBrandViews === 'function'
  );

  const mode = page.locator('#modeSeg');
  const header = page.locator('header.topbar');
  const menuHead = page.locator('#deliveryView .menu-head');

  await expect(mode).toBeVisible();
  const guestLayout = await page.evaluate(() => {
    const seg = document.getElementById('modeSeg');
    const edit = document.getElementById('editToggle');
    const titleRow = seg.closest('.menu-controls-row');
    return {
      modeInMenuRow: !!titleRow && titleRow.parentElement === document.querySelector('#deliveryView .mh-top > div:first-child'),
      modeBeforeEdit: !!titleRow && Array.from(titleRow.children).indexOf(seg) < Array.from(titleRow.children).indexOf(edit),
      headerHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
      modeHeight: seg.getBoundingClientRect().height,
      buttons: Array.from(seg.querySelectorAll('button')).map(button => button.getBoundingClientRect().height),
      buttonWidths: Array.from(seg.querySelectorAll('button')).map(button => button.getBoundingClientRect().width),
      modeScrollWidth: seg.scrollWidth,
      modeClientWidth: seg.clientWidth,
      editVisible: !edit.hidden
    };
  });
  expect(guestLayout.modeInMenuRow).toBe(true);
  expect(guestLayout.modeBeforeEdit).toBe(true);
  expect(guestLayout.headerHeight).toBeLessThanOrEqual(64);
  expect(guestLayout.modeHeight).toBeGreaterThanOrEqual(44);
  expect(guestLayout.buttons).toHaveLength(4);
  expect(guestLayout.buttons.every(height => height >= 44)).toBe(true);
  expect(guestLayout.buttonWidths).toEqual([44, 44, 44, 44]);
  expect(guestLayout.modeScrollWidth).toBeLessThanOrEqual(guestLayout.modeClientWidth + 1);
  await expect(page.locator('#deliveryRail')).toHaveClass(/rail-position-ready/);
  let railGeometry;
  try {
    await expect.poll(async () => {
      railGeometry = await page.evaluate(() => {
        const rail = document.getElementById('deliveryRail');
        const menuRow = document.querySelector('#deliveryView .menu-controls-row');
        const head = document.querySelector('#deliveryView .menu-head');
        const wrap = document.querySelector('.wrap');
        const style = getComputedStyle(rail);
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, height: box.height };
        };
        const railBox = rail.getBoundingClientRect();
        const topbarBottom = document.querySelector('header.topbar').getBoundingClientRect().bottom;
        const laneTop = Math.max(0, topbarBottom, head.getBoundingClientRect().bottom) + 12;
        const laneBottom = window.innerHeight - 12;
        const targetCenter = laneTop + Math.max(0, laneBottom - laneTop) / 2;
        const topbarBox = document.querySelector('header.topbar').getBoundingClientRect();
        const railStyle = getComputedStyle(rail);
        return {
          gap: railBox.top - menuRow.getBoundingClientRect().bottom,
          centerDelta: Math.abs((railBox.top + railBox.height / 2) - targetCenter),
          targetCenter,
          railCenter: railBox.top + railBox.height / 2,
          viewport: { innerHeight: window.innerHeight, clientHeight: document.documentElement.clientHeight,
            visualHeight: window.visualViewport ? window.visualViewport.height : null, scrollY: window.scrollY },
          topbar: { top: topbarBox.top, bottom: topbarBox.bottom, height: topbarBox.height },
          railLayout: { offsetTop: rail.offsetTop, offsetHeight: rail.offsetHeight,
            translate: railStyle.translate, transformOrigin: railStyle.transformOrigin,
            offsetParent: rail.offsetParent ? rail.offsetParent.className || rail.offsetParent.tagName : null },
          brand: document.documentElement.dataset.brand,
          railClass: rail.className,
          railDisplay: style.display,
          railPosition: style.position,
          railInlineMarginTop: rail.style.marginTop,
          railMarginTop: style.marginTop,
          railInlineTop: rail.style.top,
          railTop: style.top,
          railInlineTransform: rail.style.transform,
          railTransform: style.transform,
          wrapBottom: wrap.getBoundingClientRect().bottom,
          canCenterWithinWrap: wrap.getBoundingClientRect().bottom >= parseFloat(style.top) + rail.offsetHeight,
          head: rect(head),
          menuRow: rect(menuRow),
          rail: rect(rail),
          wrap: rect(wrap)
        };
      });
      return railGeometry.gap;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(8);
  } catch (error) {
    throw new Error(error.message + '\\nRail diagnostics: ' + JSON.stringify(railGeometry));
  }
  expect(railGeometry.gap, JSON.stringify(railGeometry)).toBeGreaterThanOrEqual(8);
  expect(railGeometry.centerDelta, JSON.stringify(railGeometry)).toBeLessThanOrEqual(2);
  await test.info().attach('staff-guest-menu-row-mobile', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  await page.evaluate(() => window.setMode('cashier'));
  await expect(page.locator('#cashierView')).toBeVisible();
  await expect(mode).toBeVisible();
  const cashierLayout = await mode.evaluate((seg) => ({
    inTopbar: seg.parentElement === document.querySelector('header.topbar'),
    topbarTop: document.querySelector('header.topbar').getBoundingClientRect().top,
    topbarHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
    topbarPosition: getComputedStyle(document.querySelector('header.topbar')).position,
    modeTop: seg.getBoundingClientRect().top,
    headerBottom: document.querySelector('header.topbar').getBoundingClientRect().bottom
  }));
  expect(cashierLayout.inTopbar).toBe(true);
  expect(cashierLayout.topbarTop).toBeLessThanOrEqual(1);
  expect(cashierLayout.topbarHeight).toBeGreaterThan(64);
  expect(cashierLayout.modeTop).toBeLessThanOrEqual(cashierLayout.headerBottom);
  expect(cashierLayout.topbarPosition).toBe('sticky');
  await test.info().attach('staff-cashier-topbar-mobile', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  await page.evaluate(() => window.setMode('orders'));
  await expect(page.locator('#ordersView')).toBeVisible();
  const ordersLayout = await mode.evaluate((seg) => ({
    inTopbar: seg.parentElement === document.querySelector('header.topbar'),
    topbarTop: document.querySelector('header.topbar').getBoundingClientRect().top,
    topbarHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
    modeBottom: seg.getBoundingClientRect().bottom,
    headerBottom: document.querySelector('header.topbar').getBoundingClientRect().bottom
  }));
  expect(ordersLayout.inTopbar).toBe(true);
  expect(ordersLayout.topbarTop).toBeLessThanOrEqual(1);
  expect(ordersLayout.topbarHeight).toBeGreaterThan(64);
  expect(ordersLayout.modeBottom).toBeLessThanOrEqual(ordersLayout.headerBottom);
  await test.info().attach('staff-orders-topbar-mobile', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  await page.evaluate(() => window.setMode('admin'));
  await expect(mode).toBeVisible();
  expect(await mode.evaluate(element => element.parentElement === document.querySelector('header.topbar'))).toBe(true);
  await page.evaluate(() => window.setMode('guest'));
  await expect(mode).toBeVisible();
  expect(await mode.evaluate(element => !!element.closest('#deliveryView .menu-controls-row'))).toBe(true);
});
