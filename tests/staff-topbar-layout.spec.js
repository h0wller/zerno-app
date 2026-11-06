import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('single staff action does not stretch the admin bar across the content column', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  const bar = page.locator('#adminBar');
  await bar.evaluate((element) => {
    element.hidden = false;
    Array.from(element.children).forEach((button, index) => { button.hidden = index > 0; });
  });
  await expect(bar).toBeVisible();
  const dimensions = await bar.evaluate((element) => ({
    parentWidth: element.getBoundingClientRect().width,
    buttonWidth: element.querySelector('button:not([hidden])').getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.parentWidth).toBeLessThanOrEqual(240);
  expect(dimensions.buttonWidth).toBeLessThanOrEqual(220);
  expect(dimensions.parentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('staff mode switch fits inside the menu actions rail before and after hydration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  const mode = page.locator('#adminBar #modeSeg');
  await expect(mode).toBeAttached();
  await page.evaluate(() => {
    document.getElementById('modeSeg').innerHTML =
      ['Кофейня', 'Доставка', 'Заказы', 'Касса']
        .map((label) => '<button type="button">' + label + '</button>')
        .join('');
  });

  const measure = () => page.evaluate(() => {
    const header = document.querySelector('header.topbar');
    const admin = document.getElementById('adminBar');
    const mode = document.getElementById('modeSeg');
    const headerBox = header.getBoundingClientRect();
    const adminBox = admin.getBoundingClientRect();
    const modeBox = mode.getBoundingClientRect();
    return {
      headerHeight: headerBox.height,
      adminHeight: adminBox.height,
      adminBottom: adminBox.bottom,
      modeHeight: modeBox.height,
      modeTop: modeBox.top,
      modeBottom: modeBox.bottom,
      gridRows: getComputedStyle(header).gridTemplateRows,
      buttonHeights: Array.from(mode.querySelectorAll('button'), (button) => button.getBoundingClientRect().height),
    };
  });

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-staff-role', 'dispatch');
    document.documentElement.removeAttribute('data-staff-ready');
  });
  const placeholder = await measure();
  expect(placeholder.modeHeight).toBe(46);
  expect(placeholder.buttonHeights).toHaveLength(4);
  expect(placeholder.buttonHeights.every((height) => height >= 44 && height <= 44.5)).toBe(true);
  expect(placeholder.modeTop).toBeGreaterThanOrEqual(0);
  expect(placeholder.modeBottom).toBeLessThanOrEqual(placeholder.adminBottom + 1);
  expect(placeholder.headerHeight).toBeLessThanOrEqual(70);

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-staff-ready', 'true');
    document.getElementById('modeSeg').hidden = false;
  });
  await expect(mode).toBeVisible();
  const hydrated = await measure();
  expect(hydrated.modeHeight).toBe(46);
  expect(hydrated.buttonHeights.every((height) => height >= 44 && height <= 44.5)).toBe(true);
  expect(hydrated.modeBottom).toBeLessThanOrEqual(hydrated.adminBottom + 1);
  expect(hydrated.headerHeight).toBeLessThanOrEqual(70);
  expect(hydrated.gridRows.split(' ').length).toBe(1);
});
