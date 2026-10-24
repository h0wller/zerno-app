import { test, expect } from '@playwright/test';

/* «Мои адреса» (core/address-book.js) в изоляции: страница-заглушка с полями чекаута и справочником улиц.
   Сервер не нужен — HTML отдаётся через page.route, скрипт подключается из исходников. */
const HOST = 'http://address-book.test/';
const STREETS = ['Советская', 'Балтийская', 'Победы'];

test.describe('Мои адреса: шторка и сохранение', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.route(HOST, (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body>
        <label>Место<select id="checkoutPlace"><option>Янтарный</option></select></label>
        <label>Улица<input id="checkoutStreet"></label>
        <label>Дом<input id="checkoutHouse"></label>
        <div id="outside">вне шторки</div></body>`
    }));
    await page.goto(HOST);
    await page.evaluate((streets) => {
      localStorage.clear();
      window.AddressModule = {
        getStreets: () => streets,
        isValidStreet: (p, s) => streets.includes(s),
        getFee: () => 0
      };
    }, STREETS);
  });

  // Как в реальном write(): список + legacy-ключ с первым адресом
  const seed = (page, list) => page.evaluate((l) => {
    localStorage.setItem('zt_saved_addresses', JSON.stringify(l));
    if (l.length) localStorage.setItem('zt_saved_address', JSON.stringify(l[0]));
  }, list);
  const load = (page) => page.addScriptTag({ path: 'public/app/core/address-book.js' });
  const sheetOpen = (page) => page.evaluate(() => !document.getElementById('addrBookSheet').hidden);
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('zt_saved_addresses') || '[]'));

  test('удаление адреса не закрывает шторку', async ({ page }) => {
    await seed(page, [
      { place: 'Янтарный', street: 'Советская', house: '70Г' },
      { place: 'Янтарный', street: 'Балтийская', house: '1' },
      { place: 'Янтарный', street: 'Победы', house: '5' }
    ]);
    await load(page);
    await page.click('#addrBookBtn');
    await expect(page.locator('.abs-row')).toHaveCount(3);

    await page.locator('.abs-row [data-abs="del"]').first().click();
    await expect(page.locator('.abs-row')).toHaveCount(2);
    expect(await sheetOpen(page)).toBe(true);
  });

  test('последний адрес удаляется насовсем и не воскресает из legacy-ключа', async ({ page }) => {
    await seed(page, [{ place: 'Янтарный', street: 'Советская', house: '70Г' }]);
    await load(page);
    await page.click('#addrBookBtn');
    await page.locator('.abs-row [data-abs="del"]').first().click();
    await expect(page.locator('.abs-empty')).toHaveCount(1);

    await page.evaluate(() => window.AddressBook.close());
    await page.click('#addrBookBtn');
    await expect(page.locator('.abs-row')).toHaveCount(0);
  });

  test('клик вне шторки и Esc закрывают её', async ({ page }) => {
    await seed(page, [{ place: 'Янтарный', street: 'Советская', house: '70Г' }]);
    await load(page);
    await page.click('#addrBookBtn');
    await page.click('.abs-head b');
    expect(await sheetOpen(page)).toBe(true);
    await page.click('#outside');
    expect(await sheetOpen(page)).toBe(false);

    await page.click('#addrBookBtn');
    await page.keyboard.press('Escape');
    expect(await sheetOpen(page)).toBe(false);
  });

  test('в книгу попадает только полный адрес с улицей из справочника (никаких «Н», «Ну», «С»)', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      const ab = window.AddressBook;
      ab.autoAdd({ place: 'Янтарный', street: 'Н', house: '7' });         // обрывок улицы
      ab.autoAdd({ place: 'Янтарный', street: 'Сов', house: '7' });       // обрывок улицы
      ab.autoAdd({ place: 'Янтарный', street: '', house: '70Г' });        // нет улицы
      ab.autoAdd({ place: 'Янтарный', street: 'Победы', house: '' });     // нет дома
    });
    expect(await stored(page)).toEqual([]);

    await page.evaluate(() => window.AddressBook.autoAdd({ place: 'Янтарный', street: 'Победы', house: '5' }));
    expect(await stored(page)).toHaveLength(1);
  });

  test('при открытии шторки мусор из прошлых версий вычищается', async ({ page }) => {
    await seed(page, [
      { place: 'Янтарный', street: 'Советская', house: '70Г' },
      { place: 'Янтарный', street: '', house: '70Г' },
      { place: 'Янтарный', street: 'Н', house: '70Г' },
      { place: 'Янтарный', street: 'Ну', house: '70Г' }
    ]);
    await load(page);
    await page.click('#addrBookBtn');
    await expect(page.locator('.abs-row')).toHaveCount(1);
    await expect(page.locator('.abs-title')).toHaveText('Янтарный, Советская, 70Г');
  });
});
