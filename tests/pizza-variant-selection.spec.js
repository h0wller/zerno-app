import { test, expect } from '@playwright/test';

const OPTIONS = [
  { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
  { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
  { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
  { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 }
];

const ITEMS = [
  {
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
    opts: OPTIONS
  },
  {
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
    opts: OPTIONS
  }
];

const RADIO_NAMES = [
  '25 см пышное 415 г 535 ₽',
  '35 см пышное 750 г 735 ₽',
  '25 см тонкое 335 г 435 ₽',
  '35 см тонкое 550 г 635 ₽'
];

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
  await expect(page.getByRole('group', { name: 'Размер и тесто' })).toHaveCount(2);
}

function pizzaCard(page, id = 'pz-radio-test') {
  return page.locator(`#deliveryGrid .card[data-product-id="${id}"]`);
}

function pizzaGroup(card) {
  return card.getByRole('group', { name: 'Размер и тесто' });
}

test.describe('native pizza variant selection', () => {
  test('initial HTML contains the same unselected native radio group as the hydrated menu', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.setItem('zt_ios_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.route('**/dmenu**', route => new Promise(resolve => {
      page.__holdDeliveryMenu = () => resolve(route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: ITEMS })
      }));
    }));
    await page.route('**/api/delivery/info', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ today: { open: 11, close: 22 }, days: [], zones: [], busySlots: [] })
    }));
    await page.route(/\\/media\\/dishes\\/.*$/, route => route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
    }));

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    const initialCard = page.locator('#deliveryGrid .card[data-product-id="1"]');
    const initialGroup = initialCard.getByRole('group', { name: 'Размер и тесто' });
    await expect(initialGroup).toBeVisible();
    await expect(initialGroup.getByRole('radio')).toHaveCount(4);
    await expect(initialGroup.getByRole('radio').first()).not.toBeChecked();
    await expect(initialGroup.locator('button')).toHaveCount(0);

    await page.evaluate(() => window.__holdDeliveryMenu());
    await expect(page.locator('#deliveryGrid .card[data-product-id="pz-radio-test"]')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Размер и тесто' })).toHaveCount(2);
  });
  test('renders two independent native radio groups without a preselected option', async ({ page }) => {
    await openPizzaMenu(page);

    const groups = page.getByRole('group', { name: 'Размер и тесто' });
    await expect(groups).toHaveCount(2);

    for (let index = 0; index < 2; index++) {
      const radios = groups.nth(index).getByRole('radio');
      await expect(radios).toHaveCount(4);
      for (let optionIndex = 0; optionIndex < RADIO_NAMES.length; optionIndex++) {
        await expect(radios.nth(optionIndex)).toHaveAccessibleName(RADIO_NAMES[optionIndex]);
        await expect(radios.nth(optionIndex)).not.toBeChecked();
      }
    }

    const names = await groups.evaluateAll(nodes =>
      nodes.map(group => Array.from(group.querySelectorAll('input[type="radio"]')).map(input => input.name))
    );
    expect(names[0].every(Boolean)).toBe(true);
    expect(new Set(names[0]).size).toBe(1);
    expect(names[1].every(Boolean)).toBe(true);
    expect(new Set(names[1]).size).toBe(1);
    expect(names[0][0]).not.toBe(names[1][0]);
  });

  test('renders the options in two columns with the legend above them', async ({ page }) => {
    await openPizzaMenu(page);

    const card = pizzaCard(page);
    const group = pizzaGroup(card);
    const labels = group.locator('label.opt-btn');
    await expect(labels).toHaveCount(4);

    const layout = await labels.evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    }));

    expect(layout[0].width).toBeGreaterThan(0);
    expect(layout[1].width).toBeGreaterThan(0);
    expect(layout[2].width).toBeGreaterThan(0);
    expect(layout[3].width).toBeGreaterThan(0);
    expect(layout[0].y).toBe(layout[1].y);
    expect(layout[2].y).toBe(layout[3].y);
    expect(layout[0].x).not.toBe(layout[1].x);
    expect(layout[2].x).toBe(layout[0].x);
    expect(layout[3].x).toBe(layout[1].x);

    const legend = group.getByText('Размер и тесто', { exact: true });
    await expect(legend).toBeVisible();
    const legendIsAboveOptions = await legend.evaluate((node, firstOption) =>
      node.getBoundingClientRect().bottom <= firstOption.getBoundingClientRect().top,
      await labels.first().elementHandle()
    );
    expect(legendIsAboveOptions).toBe(true);
  });

  test('selects a radio through its accessible label without showing validation feedback', async ({ page }) => {
    await openPizzaMenu(page);

    const card = pizzaCard(page);
    const group = pizzaGroup(card);
    const selected = group.getByRole('radio', { name: RADIO_NAMES[1] });

    await selected.check();
    await expect(selected).toBeChecked();
    await expect(group.getByRole('radio', { name: RADIO_NAMES[0] })).not.toBeChecked();
    await expect(group.locator('.opts-error')).toBeHidden();
    await expect(page.locator('#toasts .toast')).toHaveCount(0);
  });

  test('requires a choice before adding and exposes the inline error to the first radio', async ({ page }) => {
    await openPizzaMenu(page);

    const card = pizzaCard(page);
    const group = pizzaGroup(card);
    await card.getByRole('button', { name: 'Добавить' }).click();

    const error = group.locator('.opts-error');
    const first = group.getByRole('radio').first();
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Выберите размер и тесто.');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-describedby', 'pizza-option-pz-radio-test-error');
    await expect(page.locator('#toasts .toast')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zt_cart') || '[]'))).toEqual([]);
  });

  test('clears the inline error when a radio is selected', async ({ page }) => {
    await openPizzaMenu(page);

    const card = pizzaCard(page);
    const group = pizzaGroup(card);
    await card.getByRole('button', { name: 'Добавить' }).click();

    const error = group.locator('.opts-error');
    await expect(error).toBeVisible();

    const selected = group.getByRole('radio', { name: RADIO_NAMES[1] });
    await selected.check();

    await expect(selected).toBeChecked();
    await expect(error).toBeHidden();
    await expect(group.getByRole('radio')).toHaveCount(4);
    await expect(group.getByRole('radio').first()).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(page.locator('#toasts .toast')).toHaveCount(0);
  });

  test('adds the selected option with the existing cart key and price contract', async ({ page }) => {
    await openPizzaMenu(page);

    const card = pizzaCard(page);
    const group = pizzaGroup(card);
    await group.getByRole('radio', { name: RADIO_NAMES[3] }).check();
    await card.getByRole('button', { name: 'Добавить' }).click();

    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zt_cart') || '[]'))).toMatchObject([
      {
        key: 'pz-radio-test_3',
        id: 'pz-radio-test',
        oi: 3,
        opt: '35 см, тонкое',
        price: 635,
        sz: 35,
        qty: 1
      }
    ]);
  });

  test('keeps selections isolated between different pizza cards', async ({ page }) => {
    await openPizzaMenu(page);

    const first = pizzaGroup(pizzaCard(page));
    const second = pizzaGroup(pizzaCard(page, 'pz-radio-test-second'));
    const firstChoice = first.getByRole('radio', { name: RADIO_NAMES[1] });
    const secondChoice = second.getByRole('radio', { name: RADIO_NAMES[2] });

    await firstChoice.check();
    await secondChoice.check();

    await expect(firstChoice).toBeChecked();
    await expect(secondChoice).toBeChecked();
    await expect(first.getByRole('radio', { name: RADIO_NAMES[2] })).not.toBeChecked();
    await expect(second.getByRole('radio', { name: RADIO_NAMES[1] })).not.toBeChecked();
  });
});
