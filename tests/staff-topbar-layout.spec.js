import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('staff mode switch fits its reserved topbar row before and after hydration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  const header = page.locator('header.topbar');
  const mode = page.locator('#modeSeg');
  await expect(mode).toBeAttached();

  const measure = () => page.evaluate(() => {
    const header = document.querySelector('header.topbar');
    const mode = document.getElementById('modeSeg');
    const headerBox = header.getBoundingClientRect();
    const modeBox = mode.getBoundingClientRect();
    return {
      headerHeight: headerBox.height,
      modeHeight: modeBox.height,
      modeTop: modeBox.top,
      modeBottom: modeBox.bottom,
      headerBottom: headerBox.bottom,
      gridRows: getComputedStyle(header).gridTemplateRows,
    };
  });

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-staff-role', 'dispatch');
    document.documentElement.removeAttribute('data-staff-ready');
  });
  const placeholder = await measure();
  expect(placeholder.modeHeight).toBeGreaterThanOrEqual(52);
  expect(placeholder.modeBottom).toBeLessThanOrEqual(placeholder.headerBottom + 1);

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-staff-ready', 'true');
    document.getElementById('modeSeg').hidden = false;
  });
  await expect(mode).toBeVisible();
  const hydrated = await measure();
  expect(hydrated.modeHeight).toBeGreaterThanOrEqual(52);
  expect(hydrated.modeBottom).toBeLessThanOrEqual(hydrated.headerBottom + 1);
  expect(hydrated.gridRows.split(' ').length).toBeGreaterThanOrEqual(2);
});
