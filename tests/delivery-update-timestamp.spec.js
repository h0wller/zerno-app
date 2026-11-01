import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const timestamp = '2026-10-31T17:42:00.000Z';

function formatTimestamp(value) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} в ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test.describe('Дата обновления меню доставки', () => {
  test('публичный endpoint отдаёт updatedAt', async ({ request }) => {
    const response = await request.get('/api/dmenu');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(typeof data.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(data.updatedAt))).toBe(false);
  });

  test('гостевой режим показывает дату из /api/dmenu без переключения бренда', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/api/dmenu', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], updatedAt: timestamp }),
    }));

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#updWhenD')).toHaveText(formatTimestamp(timestamp));
  });

  test('staff-режим сохраняет updatedAt из /api/menu/all', async ({ page }) => {
    const staffTimestamp = '2026-10-31T18:15:00.000Z';
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_user', 'playwright-staff-token');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ customer: { id: 'staff-test', role: 'cashier' } }),
    }));
    await page.route('**/api/dmenu', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], updatedAt: timestamp }),
    }));
    await page.route('**/api/menu/all', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], updatedAt: staffTimestamp }),
    }));

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#updWhenD')).toHaveText(formatTimestamp(staffTimestamp));
  });
});
