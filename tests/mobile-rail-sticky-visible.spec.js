import { test, expect } from '@playwright/test';

test('mobile category rail stays visible as a detached capsule during active scrolling for both brands', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });

    const selector = brand === 'coffee' ? '#rail' : '#deliveryRail';
    const rail = page.locator(selector);
    await expect(rail).toBeVisible({ timeout: 15000 });

    const samples = await page.evaluate(async (railSelector) => {
      const element = document.querySelector(railSelector);
      const states = [];
      const safeAreaProbe = document.createElement('div');
      safeAreaProbe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
      document.body.appendChild(safeAreaProbe);
      const safeAreaInset = parseFloat(getComputedStyle(safeAreaProbe).paddingBottom) || 0;
      safeAreaProbe.remove();
      for (const y of [650, 690, 730, 770]) {
        window.scrollTo(0, y);
        await new Promise(resolve => setTimeout(resolve, 50));
        const style = getComputedStyle(element);
        states.push({
          position: style.position,
          visibility: style.visibility,
          opacity: Number(style.opacity),
          bottomGap: window.innerHeight - element.getBoundingClientRect().bottom,
          safeAreaInset,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
        });
      }
      return states;
    }, selector);

    expect(samples.every(state =>
      state.position === 'fixed' &&
      state.visibility !== 'hidden' &&
      state.opacity > 0 &&
      state.bottomGap >= 10 + state.safeAreaInset && state.bottomGap <= 12 + state.safeAreaInset &&
      state.left >= 12 && state.right <= 378
    ), brand + ' rail must remain visibly pinned during active scroll').toBe(true);
  }
});
