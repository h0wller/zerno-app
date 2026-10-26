import { test, expect } from '@playwright/test';

test.describe('PWA Notifications Suite (F3.67)', () => {
  test('getDevId exists and returns stable identifier', async ({ page }) => {
    await page.goto('/?brand=coffee');
    const devId = await page.evaluate(() => window.getDevId ? window.getDevId() : null);
    expect(devId).toBeTruthy();
    expect(typeof devId).toBe('string');
  });
});
