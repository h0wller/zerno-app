import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('single staff action does not stretch the admin bar across the content column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.syncBrandViews === 'function');
  await page.evaluate(() => {
    window.setUser('layout-test-admin-token', {
      role: 'admin', name: 'Layout Test Admin', phone: '+70000000000',
      verified: 1, qr: 'layout-test-admin', stamps: 0, free: 0, history: []
    });
    window.mode = 'guest';
    window.syncBrandViews();
    window.setMode('admin');
  });
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
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.syncBrandViews === 'function');
  await page.evaluate(() => {
    window.setUser('layout-test-admin-token', {
      role: 'admin', name: 'Layout Test Admin', phone: '+70000000000',
      verified: 1, qr: 'layout-test-admin', stamps: 0, free: 0, history: []
    });
    window.mode = 'guest';
    window.syncBrandViews();
  });

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
      editVisible: !edit.hidden
    };
  });
  expect(guestLayout.modeInMenuRow).toBe(true);
  expect(guestLayout.modeBeforeEdit).toBe(true);
  expect(guestLayout.headerHeight).toBeLessThanOrEqual(64);
  expect(guestLayout.modeHeight).toBeGreaterThanOrEqual(44);
  expect(guestLayout.buttons.length).toBeGreaterThanOrEqual(2);
  expect(guestLayout.buttons.every(height => height >= 44)).toBe(true);

  await page.evaluate(() => window.setMode('cashier'));
  await expect(page.locator('#cashierView')).toBeVisible();
  await expect(mode).toBeVisible();
  const cashierLayout = await mode.evaluate((seg) => ({
    inTopbar: seg.parentElement === document.querySelector('header.topbar'),
    topbarHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
    modeTop: seg.getBoundingClientRect().top,
    headerBottom: document.querySelector('header.topbar').getBoundingClientRect().bottom
  }));
  expect(cashierLayout.inTopbar).toBe(true);
  expect(cashierLayout.topbarHeight).toBeGreaterThan(64);
  expect(cashierLayout.modeTop).toBeLessThanOrEqual(cashierLayout.headerBottom);

  await page.evaluate(() => window.setMode('admin'));
  await expect(mode).toBeVisible();
  expect(await mode.evaluate(element => element.parentElement === document.querySelector('header.topbar'))).toBe(true);
  await page.evaluate(() => window.setMode('guest'));
  await expect(mode).toBeVisible();
  expect(await mode.evaluate(element => !!element.closest('#deliveryView .menu-controls-row'))).toBe(true);
});
