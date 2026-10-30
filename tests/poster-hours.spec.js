import { test, expect } from '@playwright/test';

test.describe('Poster & Delivery Hours Suite (F3.66)', () => {
  test('delivery info endpoint returns schedule and today status', async ({ request }) => {
    const res = await request.get('/api/delivery/info');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.schedule).toBeDefined();
    expect(data.today).toBeDefined();
    expect(typeof data.today.isOpen).toBe('boolean');
    expect(typeof data.today.canAcceptAsap).toBe('boolean');
    expect(data.days).toHaveLength(2);
    expect(data.days.map(day => day.offset)).toEqual([0, 1]);
    for (const day of data.days) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.open).toBe(11);
      expect([21, 22]).toContain(day.close);
    }
  });

  test('schedule honors winter calendar and poster shows hours', async ({ request, page }) => {
    const d = await (await request.get('/api/delivery/info')).json();
    expect(d.schedule.open).toBe(11);
    expect([21, 22]).toContain(d.schedule.close);
    await page.goto('/poster.html');
    await expect(page.locator('body')).toContainText('Октябрь–апрель');
    await expect(page.locator('body')).toContainText('11:00–22:00');
  });
});
