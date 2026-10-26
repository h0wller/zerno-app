import { test, expect } from '@playwright/test';

test.describe('Poster & Delivery Hours Suite (F3.66)', () => {
  test('delivery info endpoint returns schedule and today status', async ({ request }) => {
    const res = await request.get('/api/delivery/info');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.schedule).toBeDefined();
    expect(data.today).toBeDefined();
    expect(typeof data.today.isOpen).toBe('boolean');
  });
});
