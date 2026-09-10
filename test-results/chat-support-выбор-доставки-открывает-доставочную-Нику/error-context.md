# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-support.spec.js >> выбор доставки открывает доставочную Нику
- Location: tests\chat-support.spec.js:17:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/?src=tg&tab=chat&support=choose
Call log:
  - navigating to "http://localhost:3000/?src=tg&tab=chat&support=choose", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | async function skipSplash(page){
  4  |   const sp = page.locator('#brandSplash');
  5  |   if (await sp.count()) await sp.locator('[data-go="coffee"]').click();
  6  |   
  7  |   // Принудительно убираем глобальный оверлей, если он завис из-за ошибок API
  8  |   await page.evaluate(() => {
  9  |     const overlay = document.getElementById('overlay');
  10 |     if (overlay) {
  11 |       overlay.classList.remove('show');
  12 |       overlay.style.display = 'none';
  13 |     }
  14 |   });
  15 | }
  16 | 
  17 | test('выбор доставки открывает доставочную Нику', async ({ page }) => {
> 18 |   await page.goto('/?src=tg&tab=chat&support=choose');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/?src=tg&tab=chat&support=choose
  19 |   await skipSplash(page); // Гарантируем чистый DOM
  20 |   
  21 |   // Используем force: true, чтобы игнорировать возможные динамические оверлеи
  22 |   await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click({ force: true });
  23 |   
  24 |   await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  25 |   await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  26 |   await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
  27 | });
  28 | 
  29 | test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  30 |   await page.goto('/?src=tg&tab=chat&support=choose');
  31 |   await skipSplash(page);
  32 |   await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click({ force: true });
  33 |   await expect(page.locator('#chatPanel .chatHead')).toContainText('кофейня');
  34 | });
  35 | 
  36 | test('обычное открытие чата — без оверлея', async ({ page }) => {
  37 |   await page.goto('/');
  38 |   await skipSplash(page);
  39 |   await page.locator('#chatFab').click({ force: true });
  40 |   await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  41 |   await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
  42 | });
  43 | 
  44 | test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  45 |   await page.goto('/');
  46 |   await skipSplash(page);
  47 |   await page.locator('#chatFab').click({ force: true });
  48 |   const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  49 |   await call.click({ force: true });
  50 |   await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible();
  51 | });
```