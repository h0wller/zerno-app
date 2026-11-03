import { test, expect } from '@playwright/test';

const ITEMS = [{
  id: 'pz-radio-test',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Тестовая пицца',
  desc: 'Моцарелла',
  comp: ['моцарелла'],
  vol: '25/35 см',
  price: '0',
  on: 1,
  img: '/media/dishes/1-card.webp',
  opts: [
    { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
    { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
    { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
    { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 }
  ]
}, {
  id: 'pz-radio-test-second',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Вторая тестовая пицца',
  desc: 'Томатный соус',
  comp: ['томатный соус'],
  vol: '25/35 см',
  price: '0',
  on: 1,
  img: '/media/dishes/1-card.webp',
  opts: [
    { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
    { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
    { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
    { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 }
  ]
}];

async function openPizzaMenu(page) {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_ios_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/dmenu**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: ITEMS })
  }));
  await page.route('**/api/delivery/info', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ today: { open: 11, close: 22 }, days: [], zones: [], busySlots: [] })
  }));
  await page.route(/\/media\/dishes\/.*$/, route => route.fulfill({
    status: 200,
    contentType: 'image/gif',
    body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
  }));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#deliveryGrid .card[data-product-id="pz-radio-test"]')).toBeVisible();
}

test.describe('native pizza variant selection', () => {
  test('renders a labeled native radio group with no preselection and independent names per card', async ({ page }) => {
    await openPizzaMenu(page);
    const card = page.locator('#deliveryGrid .card').first();
    const group = card.locator('fieldset.opts');
    await expect(group.locator('legend')).toHaveText('Размер и тесто');
    const radios = group.getByRole('radio');
    await expect(radios).toHaveCount(4);
    await expect(radios.nth(0)).not.toBeChecked();
    await expect(radios.nth(1)).not.toBeChecked();

    const meta = await radios.evaluateAll(nodes => nodes.map(node => ({
      type: node.type,
      name: node.name,
      value: node.value,
      label: node.labels?.[0]?.textContent || ''
    })));
    expect(meta.every(item => item.type === 'radio')).toBeTruthy();
    expect(new Set(meta.map(item => item.name)).size).toBe(1);
    expect(meta.every(item => item.name)).toBeTruthy();
    expect(meta.map(item => item.label.replace(/\s+/g, ' ').trim())).toEqual([
      expect.stringContaining('25 см'),
      expect.stringContaining('35 см'),
      expect.stringContaining('25 см'),
      expect.stringContaining('35 см')
    ]);
    expect(meta.every(item => /г/.test(item.label) && /₽/.test(item.label))).toBeTruthy();

    const names = await page.locator('#deliveryGrid fieldset.opts').evaluateAll(groups =>
      groups.map(group => group.querySelector('input[type="radio"]')?.name)
    );
    expect(names[0]).not.toBe(names[1]);

    const layout = await group.evaluate(groupEl => {
      const legend = groupEl.querySelector('legend');
      const options = Array.from(groupEl.querySelectorAll('label.opt-btn'));
      const error = groupEl.querySelector('.opts-error');
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
      };
      const optionRects = options.map(rect);
      const rows = new Set(optionRects.map(option => option.y));
      const columns = new Set(optionRects.map(option => option.x));
      return {
        rowCount: rows.size,
        columnCount: columns.size,
        legend: rect(legend),
        options: optionRects,
        error: rect(error)
      };
    });
    expect(layout.rowCount).toBe(2);
    expect(layout.columnCount).toBe(2);
    expect(layout.legend.width).toBeGreaterThan(0);
    expect(layout.legend.y).toBeLessThan(layout.options[0].y);
    expect(layout.options).toHaveLength(4);
    expect(layout.options[0].y).toBe(layout.options[1].y);
    expect(layout.options[2].y).toBe(layout.options[3].y);
    expect(layout.options[0].x).not.toBe(layout.options[1].x);
    expect(layout.error.y).toBeGreaterThan(layout.options[3].y);
  });

  test('selects using the visible label text and does not trigger card-level missing-selection feedback', async ({ page }) => {
    await openPizzaMenu(page);
    const card = page.locator('#deliveryGrid .card').first();
    const radio = card.getByRole('radio', { name: /35 см пышное 750 г 735 ₽/ });
    await radio.check();
    await expect(radio).toBeChecked();
    await expect(card.locator('.opts-error')).toBeHidden();
    await expect(page.locator('#toasts .toast')).toHaveCount(0);
    await expect(card.getByRole('radio', { name: /25 см пышное 415 г 535 ₽/ })).not.toBeChecked();
  });

  test('requires an option inline, focuses the first radio, and does not show an error toast or add to cart', async ({ page }) => {
    await openPizzaMenu(page);
    const card = page.locator('#deliveryGrid .card').first();
    await card.locator('[data-add]').click();
    const error = card.locator('.opts-error');
    await expect(error).toHaveText('Выберите размер и тесто.');
    const first = card.getByRole('radio').first();
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-describedby', 'pizza-option-pz-radio-test-error');
    await expect(page.locator('#toasts .toast')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zt_cart') || '[]'))).toEqual([]);
  });

  test('adds the selected server option using the existing oi/key/price contract', async ({ page }) => {
    await openPizzaMenu(page);
    const card = page.locator('#deliveryGrid .card').first();
    const radio = card.getByRole('radio', { name: /35 см тонкое 550 г 635 ₽/ });
    await radio.check();
    await card.locator('[data-add]').click();
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('zt_cart') || '[]'));
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({
      key: 'pz-radio-test_3',
      id: 'pz-radio-test',
      oi: 3,
      opt: '35 см, тонкое',
      price: 635,
      sz: 35,
      qty: 1
    });
  });
});
