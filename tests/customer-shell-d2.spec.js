import { test, expect } from '@playwright/test';

test('category rail keeps its DOM identity and click behavior while crossing the 820px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#rail');
  await expect(rail).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll('#rail button[data-cat]').length > 1);

  await page.evaluate(() => {
    window.__d2OriginalRail = document.getElementById('rail');
  });
  await rail.locator('button[data-cat]').nth(1).click();
  await expect(rail.locator('button.on')).toHaveAttribute('data-cat', await rail.locator('button[data-cat]').nth(1).getAttribute('data-cat'));

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => page.evaluate(() => document.getElementById('rail').parentElement.classList.contains('wrap'))).toBe(true);
  expect(await page.evaluate(() => window.__d2OriginalRail === document.getElementById('rail'))).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.getElementById('rail').parentElement.id)).toBe('menuView');
  expect(await page.evaluate(() => window.__d2OriginalRail === document.getElementById('rail'))).toBe(true);
  await rail.locator('button[data-cat]').first().click();
  await expect(rail.locator('button.on')).toHaveAttribute('data-cat', await rail.locator('button[data-cat]').first().getAttribute('data-cat'));
});

test('delivery category rail keeps its existing owner and event handler after mobile reparenting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  await expect(rail).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll('#deliveryRail button[data-dcat]').length > 1);
  await page.evaluate(() => {
    window.__d2OriginalDeliveryRail = document.getElementById('deliveryRail');
  });

  const secondCategory = rail.locator('button[data-dcat]').nth(1);
  const selectedCategory = await secondCategory.getAttribute('data-dcat');
  await secondCategory.click();
  await expect(rail.locator('button.on')).toHaveAttribute('data-dcat', selectedCategory);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => page.evaluate(() => document.getElementById('deliveryRail').parentElement.classList.contains('wrap'))).toBe(true);
  expect(await page.evaluate(() => window.__d2OriginalDeliveryRail === document.getElementById('deliveryRail'))).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.getElementById('deliveryRail').parentElement.id)).toBe('deliveryView');
  expect(await page.evaluate(() => window.__d2OriginalDeliveryRail === document.getElementById('deliveryRail'))).toBe(true);
});

test('Coffee bonuses are reached through the profile panel; no separate bonus shortcut remains', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#mbonusBtn')).toHaveCount(0);

  await page.evaluate(() => {
    window.me = {
      id: 'd2-bonus-guest',
      name: 'Гость D2',
      phone: '+7 900 000-00-00',
      role: 'guest',
      cups: 4,
      stamps: 4,
      free: 0,
      history: [],
      verified: 1,
      qr: 'd2-bonus-test'
    };
    if (typeof window.__profileMeReady !== 'function') {
      throw new Error('Profile readiness hook was not initialized');
    }
    window.__profileMeReady();
    window.renderBonus();
    window.renderProfile();
  });

  await page.locator('#profileTopBtn').click();
  await expect(page.locator('#panel')).toHaveClass(/open/);
  await page.locator('#tabBonus').click();
  await expect(page.locator('#tabBonus')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pvBonus')).toBeVisible();
  await expect(page.locator('#stampGrid .stamp')).toHaveCount(10);
  await expect(page.locator('#bonusProg')).toContainText('До бесплатного кофе');
});
