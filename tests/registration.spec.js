import { test, expect } from '@playwright/test';

test.describe('Registration & Auth Suite (F3.61 - F3.63)', () => {
  test('consent box is always visible and required', async ({ page }) => {
    await page.goto('/?brand=delivery');
    await page.click('#profileTopBtn');
    const consent = page.locator('#consentBox');
    await expect(consent).toBeVisible();
    await expect(consent).toBeChecked();
  });
});
