import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function prepareToastPage(page, brand, reducedMotion) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=' + brand);
  await page.waitForFunction(() => typeof window.toast === 'function');
}

test('toast uses short non-overshooting entry and exit motion in both brands', async ({ page }) => {
  const toast = page.locator('#toasts .toast');

  for (const brand of ['coffee', 'delivery']) {
    await prepareToastPage(page, brand, 'no-preference');
    await page.evaluate(() => window.toast('Motion feedback test', 'ℹ️'));
    await expect(toast).toHaveCount(1);

    const entry = await toast.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationName: style.animationName,
        duration: style.animationDuration,
        easing: style.animationTimingFunction,
      };
    });
    expect(entry.animationName).toBe('tin');
    expect(entry.duration).toBe('0.18s');
    expect(entry.easing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');

    // .out is intentionally transient (300ms); sample faster than its lifetime.
    await expect.poll(() => toast.evaluate((element) => element.classList.contains('out')), {
      timeout: 3000,
      intervals: [50, 100],
    }).toBe(true);
    const exit = await toast.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationName: style.animationName,
        duration: style.animationDuration,
        easing: style.animationTimingFunction,
      };
    });
    expect(exit.animationName).toBe('tout');
    expect(exit.duration).toBe('0.12s');
    expect(exit.easing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');

    await expect(toast).toHaveCount(0, { timeout: 1000 });
  }
});

test('toast appears and disappears without animation under reduced motion', async ({ page }) => {
  const toast = page.locator('#toasts .toast');

  for (const brand of ['coffee', 'delivery']) {
    await prepareToastPage(page, brand, 'reduce');
    await page.evaluate(() => window.toast('Reduced motion feedback test', 'ℹ️'));
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveCSS('animation-name', 'none');
    await expect(toast).toHaveCSS('animation-duration', '0s');
    await expect(toast).toHaveCSS('opacity', '1');

    // .out is intentionally transient (300ms); sample faster than its lifetime.
    await expect.poll(() => toast.evaluate((element) => element.classList.contains('out')), {
      timeout: 3000,
      intervals: [50, 100],
    }).toBe(true);
    await expect(toast).toHaveCSS('animation-name', 'none');
    await expect(toast).toHaveCSS('opacity', '0');
    await expect(toast).toHaveCount(0, { timeout: 1000 });
  }
});
