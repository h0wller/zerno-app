// tests/registration.spec.js
import { test, expect } from '@playwright/test';

test.describe('Registration & Auth Suite (F3.61 - F3.63)', () => {
  test('consent box is always visible and required', async ({ page }) => {
    await page.goto('/?brand=delivery');
    await page.click('#profileTopBtn');
    const consent = page.locator('#consentBox');
    await expect(consent).toBeVisible();
    await expect(consent).not.toBeChecked(); // согласие не пред-отмечено (ч. 1 ст. 9 152-ФЗ)
    // Без галочки отправку формы режет capture-гард согласия из admin-extra.js
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'согласие' })).toBeVisible();
    // С галочкой доходим до валидации полей — значит требование согласия выполнено
    await consent.check();
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'Введите имя' })).toBeVisible();
  });
});