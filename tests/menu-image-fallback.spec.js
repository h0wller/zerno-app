import { test, expect } from '@playwright/test';

test('missing dish WebP falls back to the menu emoji without requesting an SVG', async ({ page }) => {
  const svgRetries = [];
  page.on('request', (request) => {
    if (request.url().includes('__egm-missing-card.svg')) svgRetries.push(request.url());
  });
  await page.route('**/__egm-missing-card.webp*', (route) =>
    route.fulfill({ status: 404, contentType: 'image/webp', body: '' })
  );

  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#grid .media').first()).toBeAttached();
  await page.evaluate(() => {
    const media = document.querySelector('#grid .media');
    const image = new Image();
    image.alt = 'Тестовое изображение';
    image.dataset.fallbackEmoji = '⚡';
    image.src = '/media/dishes/__egm-missing-card.webp';
    media.appendChild(image);
  });

  await expect(page.locator('#grid .media [data-img-fallback="1"]')).toHaveText('⚡');
  expect(svgRetries).toEqual([]);
});
