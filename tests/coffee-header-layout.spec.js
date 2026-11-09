import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test('coffee wordmark “и кофе” remains visible beside the logo without reaching the profile button', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.goto('/?brand=coffee');
  const wordmark = page.locator('#brandTitle');
  const profile = page.locator('#profileTopBtn');
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveAttribute('aria-label', '…и кофе');
  await expect(profile).toBeVisible();

  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => link.href.includes('/app/ui/theme/'));
    return links.length > 0 && links.every((link) => link.media !== 'print' && link.sheet !== null);
  });
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.evaluate(() => {
    const wordmark = document.getElementById('brandTitle');
    const profile = document.getElementById('profileTopBtn');
    const wordmarkRect = wordmark.getBoundingClientRect();
    const profileRect = profile.getBoundingClientRect();
    return {
      text: wordmark.getAttribute('aria-label'),
      clientWidth: wordmark.clientWidth,
      scrollWidth: wordmark.scrollWidth,
      wordmarkRight: wordmarkRect.right,
      profileLeft: profileRect.left,
    };
  });

  expect(metrics.text).toBe('…и кофе');
  expect(metrics.clientWidth).toBeGreaterThanOrEqual(120);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.wordmarkRight).toBeLessThan(metrics.profileLeft - 8);
});
