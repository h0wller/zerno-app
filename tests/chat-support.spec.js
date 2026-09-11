// tests/chat-support.spec.js
import { test, expect } from '@playwright/test';

/**
 * Подготовка страницы: эмулируем «вернувшегося» гостя, чтобы приложение
 * НЕ открывало модал авторизации автоматически (иначе #overlay.show
 * перекрывает чат и оверлей поддержки и перехватывает все клики).
 */
async function prepare(page, url = '/') {
  await page.addInitScript(() => localStorage.setItem('zt_onb', '1'));
  await page.goto(url);
  const sp = page.locator('#brandSplash');
  if (await sp.count()) {
    await sp.locator('[data-go="coffee"]').click();
  }
}

test('поддержка из бота: оверлей появляется и НЕ исчезает', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  const ov = page.locator('#supportChooseOverlay');
  await expect(ov).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(2000); // регрессия «появилась на секунду»
  await expect(ov).toBeVisible();
});

test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('#chatPanel .chat-h')).toContainText('доставка');
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('#chatPanel .chat-h')).toContainText('кофейня');
});

test('обычное открытие чата — без оверлея', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();
  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await call.click();
  // первый тап только взводит подтверждение, сообщение НЕ отправляется
  await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible();
});
