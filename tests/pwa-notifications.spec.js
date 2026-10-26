import { test, expect } from '@playwright/test';

test.describe('PWA Notifications Suite (F3.67)', () => {
  test('getDevId exists and returns stable identifier', async ({ page }) => {
    await page.goto('/?brand=coffee');
    const devId = await page.evaluate(() => window.getDevId ? window.getDevId() : null);
    expect(devId).toBeTruthy();
    expect(typeof devId).toBe('string');
  });
  test('getDevId is stable across calls (self-heal контракт: cid+dev в POST /api/push/subscribe)', async ({ page }) => {
    await page.goto('/?brand=coffee');
    const [a, b] = await page.evaluate(() => [window.getDevId(), window.getDevId()]);
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });
  test('push button hidden in Telegram Mini App', async ({ page }) => {
    await page.addInitScript(() => {
      window.Telegram = { WebApp: { initData: 'x', ready() {}, expand() {} } };
    });
    await page.goto('/?src=tg&brand=coffee');
    await page.evaluate(() => window.refreshPushBtn && window.refreshPushBtn());
    await expect(page.locator('#pushBtn')).toBeHidden();
  });
});
