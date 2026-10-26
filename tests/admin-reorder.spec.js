import { test, expect } from '@playwright/test';

test.describe('Admin Reorder Suite (F3.70)', () => {
  test('reorder endpoint requires admin guard', async ({ request }) => {
    const res = await request.put('/api/menu/reorder', {
      data: { brand: 'coffee', ids: ['1', '2'] }
    });
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });
  test('admin drag reorder persists after reload', async ({ page }) => {
    const digits = '9' + String(Date.now()).slice(-9);
    const reg = await page.request.post('/api/auth/register', { data: { name: 'F370 Admin', phone: '+7' + digits, pin: '1234', consent: 1 } });
    const { token } = await reg.json();
    const act = await page.request.post('/api/auth/activate', { data: { code: process.env.ADMIN_CODE || '3364' }, headers: { Authorization: 'Bearer ' + token } });
    expect(act.ok()).toBeTruthy();
    await page.addInitScript((t) => {
      localStorage.setItem('zt_user', t); window.USER_TOKEN = t;
      localStorage.setItem('zt_onb', '1'); sessionStorage.setItem('splashDone', '1');
    }, token);
    await page.goto('/?brand=coffee');
    await page.waitForFunction(() => window.me && window.me.role === 'admin', null, { timeout: 15000 });
    await page.click('#editToggle');
    const first = page.locator('#grid .card').first();
    const second = page.locator('#grid .card').nth(1);
    const secondId = await second.getAttribute('data-item-id');
    await second.dragTo(first);
    await page.waitForTimeout(600);
    await page.reload();
    await page.waitForFunction(() => window.me && window.me.role === 'admin', null, { timeout: 15000 });
    expect(await page.locator('#grid .card').first().getAttribute('data-item-id')).toBe(secondId);
  });
  test('guest cards are not draggable', async ({ page }) => {
    await page.goto('/?brand=coffee');
    await expect(page.locator('#grid .card[draggable="true"]')).toHaveCount(0);
  });
});
