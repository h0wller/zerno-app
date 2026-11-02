import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test('coffee header subtitle fits its reserved slot without reaching the profile button', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.goto('/?brand=coffee');
  const subtitle = page.locator('#brandSub');
  await expect(subtitle).toHaveText('кофейня на берегу моря');
  await expect(page.locator('#profileTopBtn')).toBeVisible();

  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => link.href.includes('/app/ui/theme/'));
    return links.length > 0 && links.every((link) => link.media !== 'print' && link.sheet !== null);
  });
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.evaluate(() => {
    const subtitle = document.getElementById('brandSub');
    const profile = document.getElementById('profileTopBtn');
    const subtitleRect = subtitle.getBoundingClientRect();
    const profileRect = profile.getBoundingClientRect();
    return {
      clientWidth: subtitle.clientWidth,
      scrollWidth: subtitle.scrollWidth,
      fontSize: parseFloat(getComputedStyle(subtitle).fontSize),
      letterSpacing: getComputedStyle(subtitle).letterSpacing,
      subtitleRight: subtitleRect.right,
      profileLeft: profileRect.left,
    };
  });

  expect(metrics.clientWidth).toBeGreaterThanOrEqual(120);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.fontSize).toBeLessThanOrEqual(9);
  expect(metrics.subtitleRight).toBeLessThan(metrics.profileLeft - 8);
});
