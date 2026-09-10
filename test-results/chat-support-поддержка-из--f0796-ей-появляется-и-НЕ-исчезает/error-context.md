# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-support.spec.js >> поддержка из бота: оверлей появляется и НЕ исчезает
- Location: tests\chat-support.spec.js:8:1

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
  6  | }
  7  | 
  8  | test('поддержка из бота: оверлей появляется и НЕ исчезает', async ({ page }) => {
> 9  |   await page.goto('/?src=tg&tab=chat&support=choose');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/?src=tg&tab=chat&support=choose
  10 |   const ov = page.locator('#supportChooseOverlay');
  11 |   await expect(ov).toBeVisible({ timeout: 6000 });
  12 |   await page.waitForTimeout(2000);            // регрессия «появилась на секунду»
  13 |   await expect(ov).toBeVisible();
  14 | });
  15 | 
  16 | test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  17 |   await page.goto('/?src=tg&tab=chat&support=choose');
  18 |   await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click();
  19 |   await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  20 |   await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  21 |   await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 }); // подсказки не глотаются
  22 | });
  23 | 
  24 | test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  25 |   await page.goto('/?src=tg&tab=chat&support=choose');
  26 |   await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click();
  27 |   await expect(page.locator('#chatPanel .chatHead')).toContainText('кофейня');
  28 | });
  29 | 
  30 | test('обычное открытие чата — без оверлея', async ({ page }) => {
  31 |   await page.goto('/');
  32 |   await skipSplash(page);
  33 |   await page.locator('#chatFab').click();
  34 |   await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  35 |   await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
  36 | });
  37 | 
  38 | test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  39 |   await page.goto('/');
  40 |   await skipSplash(page);
  41 |   await page.locator('#chatFab').click();
  42 |   const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  43 |   await call.click();
  44 |   await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible(); // первый тап не отправляет
  45 | });
```