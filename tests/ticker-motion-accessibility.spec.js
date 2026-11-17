import { test, expect } from '@playwright/test';

test.use({
  serviceWorkers: 'block',
  reducedMotion: 'no-preference',
});

for (const brand of ['coffee', 'delivery']) {
  test(`${brand}: ticker loops continuously and supports pointer/keyboard pause`, async ({ page }) => {
    await page.goto(`/?brand=${brand}`, { waitUntil: 'domcontentloaded' });

    const viewport = page.locator('.tickerViewport');
    const ticker = page.locator('.ticker');
    const track = page.locator('#tickerTrack');

    await expect(viewport).toHaveAttribute('role', 'button', { timeout: 15000 });
    await expect(viewport).toHaveAttribute('tabindex', '0');
    await expect(viewport).toHaveAttribute('aria-pressed', 'false');
    await expect(ticker).toHaveClass(/is-overflowing/);

    for (const width of [320, 390, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => track.evaluate((element) => {
        const groups = Array.from(element.querySelectorAll('.tickerGroup'));
        const viewportWidth = element.parentElement.clientWidth;
        const groupWidth = groups[0]?.getBoundingClientRect().width || 0;
        const expectedGroups = groupWidth > 0
          ? Math.max(1, Math.ceil(viewportWidth / groupWidth) + 1) * 2
          : -1;
        return groupWidth > 0 &&
          groups.length === expectedGroups &&
          element.scrollWidth >= viewportWidth * 2;
      }), { timeout: 10000 }).toBe(true);
    }

    await viewport.click();
    await expect(viewport).toHaveAttribute('aria-pressed', 'true');
    await expect(viewport).toHaveAttribute('aria-label', 'Возобновить движение объявлений');
    await expect(ticker).toHaveClass(/is-paused/);
    await expect.poll(() => track.evaluate((element) => getComputedStyle(element).animationPlayState))
      .toBe('paused');

    await viewport.focus();
    await page.keyboard.press('Enter');
    await expect(viewport).toHaveAttribute('aria-pressed', 'false');
    await expect(viewport).toHaveAttribute('aria-label', 'Приостановить движение объявлений');
    await expect(ticker).not.toHaveClass(/is-paused/);

    await page.keyboard.press('Space');
    await expect(viewport).toHaveAttribute('aria-pressed', 'true');
    await expect(ticker).toHaveClass(/is-paused/);
  });
}

test('reduced-motion starts paused but allows an explicit user start', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const viewport = page.locator('.tickerViewport');
  const ticker = page.locator('.ticker');
  const track = page.locator('#tickerTrack');

  await expect(viewport).toHaveAttribute('role', 'button', { timeout: 15000 });
  await expect(viewport).toHaveAttribute('aria-pressed', 'true');
  await expect(ticker).toHaveClass(/is-paused/);
  await expect.poll(() => track.evaluate((element) => getComputedStyle(element).animationName))
    .toBe('none');

  await viewport.click();
  await expect(viewport).toHaveAttribute('aria-pressed', 'false');
  await expect(ticker).toHaveClass(/is-user-playing/);
  await expect.poll(() => track.evaluate((element) => getComputedStyle(element).animationName))
    .not.toBe('none');
  await expect.poll(() => track.evaluate((element) => getComputedStyle(element).animationPlayState))
    .toBe('running');
});
