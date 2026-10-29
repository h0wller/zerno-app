import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const viewports = [
  { name: 'coffee desktop', brand: 'coffee', width: 1280, height: 900 },
  { name: 'delivery compact phone', brand: 'delivery', width: 360, height: 640 },
  { name: 'coffee landscape phone', brand: 'coffee', width: 844, height: 390 },
];

for (const viewport of viewports) {
  test(`auth modal stays usable: ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto(`/?brand=${viewport.brand}`);
    await page.waitForFunction(() => typeof window.openAuth === 'function');
    await page.waitForFunction(() =>
      Array.from(document.styleSheets).some((sheet) =>
        sheet.href && sheet.href.includes('160-14-auth-modal.css')
      )
    );

    await page.evaluate(() => window.openAuth(false));
    const modal = page.locator('#authModal');
    const card = modal.locator('.authcard');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal.locator('.auth-kicker')).toHaveText('Единый профиль');
    await expect(card.locator('#regName')).toBeVisible();

    await page.waitForFunction(() => {
      const cardEl = document.querySelector('#authModal .authcard');
      return cardEl && getComputedStyle(cardEl).opacity === '1';
    });

    const layout = await page.evaluate(() => {
      const cardEl = document.querySelector('#authModal .authcard');
      const input = document.querySelector('#authModal #regName');
      const close = document.querySelector('#authModal .mclose');
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        card: rect(cardEl),
        input: rect(input),
        close: rect(close),
        overflowY: getComputedStyle(cardEl).overflowY,
        contentWidth: cardEl.clientWidth,
        contentScrollWidth: cardEl.scrollWidth,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport.width);
    expect(layout.card.x).toBeGreaterThanOrEqual(-1);
    expect(layout.card.y).toBeGreaterThanOrEqual(-1);
    expect(layout.card.right).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.card.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
    expect(layout.input.height).toBeGreaterThanOrEqual(44);
    expect(layout.close.width).toBeGreaterThanOrEqual(44);
    expect(layout.close.height).toBeGreaterThanOrEqual(44);
    expect(layout.overflowY).toBe('auto');
    expect(layout.contentScrollWidth).toBeLessThanOrEqual(layout.contentWidth + 1);

    await card.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(card.locator('#regBtn')).toBeInViewport();
  });
}
