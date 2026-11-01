import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 360, height: 800 },
  serviceWorkers: 'block',
});

test('расписание Пятницы на узком экране выравнивает время под названием периода', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const times = page.locator('#fridayInfo .friday-info-hours-row span');
  await expect(times).toHaveCount(2);
  await expect.poll(() => times.first().evaluate(element => getComputedStyle(element).textAlign))
    .toBe('left');
});
