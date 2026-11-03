// tests/menu-cards.spec.js
// Аудит карточек меню: одинаковая высота в ряду, прижатый к низу футер,
// одинаковый резерв под описание и тап-таргеты >= 44x44px.
//
// Зачем отдельный файл: pwa-responsive.spec.js проверяет «нет горизонтального скролла»
// и тап-таргеты, но молча проходит, если сетка не отрендерилась (tapTargets.length === 0),
// и высоту карточек не меряет вовсе. Здесь сетка обязательна к появлению — иначе тест падает.
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667, isMobile: true },
  { name: 'iPhone 14/15', width: 390, height: 844, isMobile: true },
  { name: 'iPad', width: 768, height: 1024, isMobile: false },
  { name: 'Desktop', width: 1280, height: 800, isMobile: false },
];

const BRANDS = [
  { name: 'Кофейня', url: '/?brand=coffee', grid: '#grid', foot: '.cfoot', minCards: 5 },
  { name: 'Доставка', url: '/?brand=delivery', grid: '#deliveryGrid', foot: '.steprow', minCards: 6 },
];

/** Тап-таргеты карточек: опции размера, кнопка добавления, степпер количества. */
const TAP_SELECTORS = [
  '#deliveryGrid .opts button',
  '#deliveryGrid [data-add]',
  '#deliveryGrid [data-step]',
  '#grid .cfoot button',
];
const TAP_MIN = 44;

/** Равны ли числа с допуском (субпиксельная раскладка сетки даёт доли пикселя). */
const spread = (nums) => Math.max(...nums) - Math.min(...nums);

const DELIVERY_ITEMS = [
  {
    id: 'pz-marg', section: 'delivery', cat: 'pizza', e: '🍕', name: 'Маргарита', tag: 'Острое',
    desc: 'Красный соус, моцарелла', comp: ['красный соус', 'моцарелла'],
    vol: '25/35 см', price: '0', on: 1, opts: [
      { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
      { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
      { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
      { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 }
    ]
  },
  {
    id: 'pz-hamgr', section: 'delivery', cat: 'pizza', e: '🍕', name: 'Ветчина и грибы', tag: 'Рекомендуем',
    desc: 'Белый соус, моцарелла, шампиньоны, ветчина, чеддер',
    comp: ['белый соус', 'моцарелла', 'шампиньоны', 'ветчина', 'чеддер'],
    vol: '25/35 см', price: '0', on: 1, opts: [
      { l: '25 см, пышное', w: '545 г', p: 745, sz: 25 },
      { l: '35 см, пышное', w: '990 г', p: 1095, sz: 35 },
      { l: '25 см, тонкое', w: '465 г', p: 645, sz: 25 },
      { l: '35 см, тонкое', w: '790 г', p: 995, sz: 35 }
    ]
  },
  {
    id: 'pz-veg', section: 'delivery', cat: 'pizza', e: '🍕', name: 'Овощная',
    desc: 'Песто, баклажаны, цукини, перец, помидоры черри, брокколи, руккола',
    comp: ['песто', 'баклажаны', 'цукини', 'перец', 'черри', 'брокколи', 'руккола'],
    vol: '25/35 см', price: '0', on: 1, opts: [
      { l: '25 см, пышное', w: '485 г', p: 635, sz: 25 },
      { l: '35 см, пышное', w: '870 г', p: 935, sz: 35 },
      { l: '25 см, тонкое', w: '405 г', p: 535, sz: 25 },
      { l: '35 см, тонкое', w: '670 г', p: 835, sz: 35 }
    ]
  },
  {
    id: 'pz-cheese', section: 'delivery', cat: 'pizza', e: '🍕', name: 'Сырная',
    desc: 'Белый соус, моцарелла, чеддер, камамбер',
    comp: ['белый соус', 'моцарелла', 'чеддер', 'камамбер'],
    vol: '25/35 см', price: '0', on: 1, opts: [
      { l: '25 см, пышное', w: '500 г', p: 845, sz: 25 },
      { l: '35 см, пышное', w: '850 г', p: 1145, sz: 35 },
      { l: '25 см, тонкое', w: '420 г', p: 745, sz: 25 },
      { l: '35 см, тонкое', w: '650 г', p: 1045, sz: 35 }
    ]
  },
  {
    id: 'pz-hamsal', section: 'delivery', cat: 'pizza', e: '🍕', name: 'Ветчина-салями',
    desc: 'Красный соус, моцарелла, салями, ветчина, перец, руккола',
    comp: ['красный соус', 'моцарелла', 'салями', 'ветчина', 'перец', 'руккола'],
    vol: '25/35 см', price: '0', on: 1, opts: [
      { l: '25 см, пышное', w: '470 г', p: 790, sz: 25 },
      { l: '35 см, пышное', w: '860 г', p: 1090, sz: 35 },
      { l: '25 см, тонкое', w: '390 г', p: 690, sz: 25 },
      { l: '35 см, тонкое', w: '660 г', p: 990, sz: 35 }
    ]
  },
  {
    id: 'pz-bacon', section: 'delivery', cat: 'pizza', e: '🍕', name: 'С беконом',
    desc: 'Белый соус, моцарелла, шампиньоны, бекон, маринованный огурец, красный лук',
    comp: ['белый соус', 'моцарелла', 'шампиньоны', 'бекон', 'огурец', 'лук'],
    vol: '25/35 см', price: '0', on: 1, opts: [
      { l: '25 см, пышное', w: '510 г', p: 740, sz: 25 },
      { l: '35 см, пышное', w: '930 г', p: 1140, sz: 35 },
      { l: '25 см, тонкое', w: '430 г', p: 640, sz: 25 },
      { l: '35 см, тонкое', w: '730 г', p: 1040, sz: 35 }
    ]
  }
];

async function routeDeliveryFixture(page) {
  await page.route('**/dmenu**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: DELIVERY_ITEMS.map((item) => ({ ...item, img: '/media/dishes/1-card.webp' }))
    })
  }));
  await page.route(/\/media\/dishes\/.*$/, (route) => route.fulfill({
    status: 200,
    contentType: 'image/gif',
    body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
  }));
}

test('delivery API seed includes at least six active pizza cards', async ({ request }) => {
  const response = await request.get('/api/dmenu');
  expect(response.ok()).toBeTruthy();
  const { items = [] } = await response.json();
  const activePizzas = items.filter((item) =>
    item.section === 'delivery' && item.cat === 'pizza' && Number(item.on) === 1
  );
  expect(activePizzas.length, 'test database must keep the complete active pizza seed').toBeGreaterThanOrEqual(6);
});


test('карточки показывают смысловые бейджи, а редактор предлагает расширенный набор', async ({ page }) => {
  await routeDeliveryFixture(page);
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');

  const spicyBadge = page.locator('#deliveryGrid [data-product-id="pz-marg"] .tag');
  const recommendedBadge = page.locator('#deliveryGrid [data-product-id="pz-hamgr"] .tag');
  await expect(spicyBadge).toHaveText('Острое');
  await expect(spicyBadge).toHaveClass(/spicy/);
  await expect(recommendedBadge).toHaveText('Рекомендуем');
  await expect(recommendedBadge).toHaveClass(/recommended/);

  const badgeOptions = await page.locator('#emTag option').allTextContents();
  expect(badgeOptions).toEqual(expect.arrayContaining([
    'Хит', 'Новинка', 'Веганское', 'Острое',
    'Рекомендуем', 'Сезонное', 'Лимитка', 'Без кофеина'
  ]));
});

test.describe('Карточки меню: высота, выравнивание, тап-таргеты', () => {
  test.use({ serviceWorkers: 'block' });

  for (const vp of VIEWPORTS) {
    for (const brand of BRANDS) {
      test.describe(`${vp.name} (${vp.width}×${vp.height}) · ${brand.name}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          if (brand.name === 'Доставка') await routeDeliveryFixture(page);
          await page.addInitScript(() => {
            localStorage.setItem('zt_onb', '1');
            sessionStorage.setItem('splashDone', '1');
          });
          const deliveryResponse = brand.name === 'Доставка'
            ? page.waitForResponse((res) => new URL(res.url()).pathname.replace(/\/+$/, '').endsWith('/dmenu'), { timeout: 5000 })
            : null;
          await page.goto(brand.url, { waitUntil: 'domcontentloaded' });
          if (deliveryResponse) {
            const response = await deliveryResponse;
            expect(response.ok()).toBeTruthy();
            const items = (await response.json()).items;
            expect(items).toHaveLength(6);
            expect(items[0].id).toBe('pz-marg');
          }
          // Ждём полный рендер каталога (он дорисовывается постепенно), а не первую карточку и не скелетоны.
          const cardSel = `${brand.grid} .card:not(.skeleton-card)`;
          await expect
            .poll(() => page.locator(cardSel).count(), { timeout: 5000 })
            .toBeGreaterThanOrEqual(brand.minCards);
          // Подмена шрифта меняет высоту карточек на пару пикселей — замеряем только после неё.
          await page.evaluate(() => document.fonts.ready);
          // Раскладка устоялась: высота первой карточки не меняется два замера подряд.
          await expect.poll(async () => {
            const h1 = await page.locator(cardSel).first().evaluate((el) => el.getBoundingClientRect().height);
            await page.waitForTimeout(150);
            const h2 = await page.locator(cardSel).first().evaluate((el) => el.getBoundingClientRect().height);
            return Math.abs(h1 - h2) < 0.5;
          }, { timeout: 5000 }).toBe(true);
        });

        test('сетка отрендерилась (иначе остальные проверки бессмысленны)', async ({ page }) => {
          const count = await page.locator(`${brand.grid} .card:not(.skeleton-card)`).count();
          expect(count, `В ${brand.grid} должно быть не меньше ${brand.minCards} карточек`).toBeGreaterThanOrEqual(brand.minCards);
        });

        test('карточки в одном ряду одинаковой высоты', async ({ page }) => {
          const rows = await page.evaluate((grid) => {
            const byRow = new Map();
            for (const c of document.querySelectorAll(`${grid} .card:not(.skeleton-card)`)) {
              const r = c.getBoundingClientRect();
              if (!r.height) continue;
              const key = Math.round(r.top);
              if (!byRow.has(key)) byRow.set(key, []);
              byRow.get(key).push(Math.round(r.height * 10) / 10);
            }
            return [...byRow.entries()].map(([top, heights]) => ({ top, heights }));
          }, brand.grid);

          expect(rows.length, 'не удалось снять ни одного ряда карточек').toBeGreaterThan(0);
          for (const row of rows) {
            expect(
              spread(row.heights),
              `Ряд на top=${row.top}: высоты расходятся на ${spread(row.heights)}px → ${JSON.stringify(row.heights)}`
            ).toBeLessThanOrEqual(1);
          }
        });

         test('высота рядов стабильна: внеэкранные карточки не «прыгают» при отрисовке', async ({ page }) => {
          // content-visibility: auto у карточек с 5-й: резерв высоты обязан совпадать с реальной,
          // иначе при скролле ряды меняют высоту (CLS) и сетка выглядит разнобойной.
          const cardSel = `${brand.grid} .card:not(.skeleton-card)`;

          // Сетка дорисовывается постепенно — ждём, пока число карточек устоится.
          await expect.poll(async () => {
            const a = await page.locator(cardSel).count();
            await page.waitForTimeout(250);
            return a === (await page.locator(cardSel).count()) ? a : -1;
          }, { timeout: 10000 }).toBeGreaterThan(0);

          // Высота каждого ряда; ряд определяется позицией в документе, а не в окне.
          const rowHeights = (grid) => {
            const rows = new Map();
            for (const c of document.querySelectorAll(`${grid} .card:not(.skeleton-card)`)) {
              const r = c.getBoundingClientRect();
              if (!r.height) continue;
              const key = Math.round(r.top + window.scrollY);
              if (!rows.has(key)) rows.set(key, []);
              rows.get(key).push(Math.round(r.height));
            }
            return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => Math.max(...h));
          };

          const before = await page.evaluate(rowHeights, brand.grid);

          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(700);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(700);

          const after = await page.evaluate(rowHeights, brand.grid);

          expect(after.length, 'после скролла ряды пропали').toEqual(before.length);
          const drift = Math.max(...before.map((b, i) => Math.abs(b - after[i])));
          expect(
            drift,
            `Высоты рядов до/после скролла: ${JSON.stringify({ before, after })}`
          ).toBeLessThanOrEqual(6);
        });

        test('футер прижат к низу, отступ одинаковый у всех карточек', async ({ page }) => {
          // content-visibility пропускает раскладку внеэкранных карточек — рендерим все.
          const cards = page.locator(`${brand.grid} .card:not(.skeleton-card)`);
          for (let i = 0, n = await cards.count(); i < n; i++) {
            await cards.nth(i).scrollIntoViewIfNeeded();
          }
          await page.waitForTimeout(300);
          const gaps = await page.evaluate(({ grid, foot }) => {
            const out = [];
            for (const c of document.querySelectorAll(`${grid} .card:not(.skeleton-card)`)) {
              const f = c.querySelector(foot);
              const r = c.getBoundingClientRect();
              if (!f || !r.height) continue;
              out.push(Math.round((r.bottom - f.getBoundingClientRect().bottom) * 10) / 10);
            }
            return out;
          }, { grid: brand.grid, foot: brand.foot });

          expect(gaps.length, `не нашлось ни одного ${brand.foot}`).toBeGreaterThan(0);
          expect(
            spread(gaps),
            `Отступ футера от низа карточки гуляет: ${JSON.stringify([...new Set(gaps)])}`
          ).toBeLessThanOrEqual(1);
          // 14px padding-bottom тела карточки + рамка; больше 20px — значит футер не прижат.
          expect(Math.max(...gaps), 'футер не прижат к низу карточки').toBeLessThanOrEqual(20);
        });

        test('описание занимает одинаковый резерв высоты (нет «прыгающих» строк)', async ({ page }) => {
          const heights = await page.evaluate((grid) => {
            const out = [];
            for (const c of document.querySelectorAll(`${grid} .card:not(.skeleton-card)`)) {
              const d = c.querySelector('.desc');
              if (d) out.push(Math.round(d.getBoundingClientRect().height));
            }
            return out;
          }, brand.grid);

          if (heights.length) {
            expect(
              spread(heights),
              `Высота блока описания различается: ${JSON.stringify([...new Set(heights)])}`
            ).toBeLessThanOrEqual(1);
          }
        });
      });
    }
  }

  test.describe('Тап-таргеты карточек доставки', () => {
    for (const vp of VIEWPORTS) {
      test(`${vp.name} (${vp.width}×${vp.height}): все цели ≥ ${TAP_MIN}×${TAP_MIN}px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await routeDeliveryFixture(page);
        await page.addInitScript(() => {
          localStorage.setItem('zt_onb', '1');
          sessionStorage.setItem('splashDone', '1');
        });
        const deliveryResponse = page.waitForResponse((res) =>
          new URL(res.url()).pathname.replace(/\/+$/, '').endsWith('/dmenu'), { timeout: 5000 }
        );
        await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
        const response = await deliveryResponse;
        expect(response.ok()).toBeTruthy();
        const items = (await response.json()).items;
        expect(items).toHaveLength(6);
        expect(items[0].id).toBe('pz-marg');
        await page.waitForSelector('#deliveryGrid .card:not(.skeleton-card)', { timeout: 5000 });
        await page.waitForTimeout(500);

        // Кладём одну позицию в корзину, чтобы степпер «−/+» перестал быть hidden и тоже попал в замер.
        const firstOpt = page.locator('#deliveryGrid .opts button').first();
        if (await firstOpt.isVisible().catch(() => false)) await firstOpt.click({ force: true }).catch(() => {});
        await page.locator('#deliveryGrid [data-add]').first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);

        const targets = await page.evaluate((selectors) => {
          const out = [];
          for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
              const r = el.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue; // hidden-степперы не в счёт
              out.push({
                sel,
                text: (el.textContent || '').trim().slice(0, 24),
                w: Math.round(r.width * 10) / 10,
                h: Math.round(r.height * 10) / 10,
              });
            }
          }
          return out;
        }, TAP_SELECTORS);

        // Защита от «тихого» прохождения: сетка обязана быть живой.
        expect(targets.length, 'тап-таргеты не найдены — сетка не отрендерилась').toBeGreaterThanOrEqual(6);

        const small = targets.filter((t) => t.w < TAP_MIN || t.h < TAP_MIN);
        expect(
          small.length,
          `${small.length} тап-таргетов меньше ${TAP_MIN}×${TAP_MIN}px: ${JSON.stringify(small.slice(0, 5))}`
        ).toBe(0);
      });
    }
  });
});
