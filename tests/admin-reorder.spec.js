import { test, expect } from '@playwright/test';

test.describe('Admin Reorder Suite (F3.70)', () => {
  test('reorder endpoint requires admin guard', async ({ request }) => {
    const res = await request.put('/api/menu/reorder', {
      data: { brand: 'coffee', ids: ['1', '2'] }
    });
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });
});
