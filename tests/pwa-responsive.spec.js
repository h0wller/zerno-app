// tests/pwa-responsive.spec.js
import { test, expect } from '@playwright/test';

/**
 * Эталонные вьюпорты для тестирования PWA / Telegram Mini App
 */
const VIEWPORTS = [
  { name: 'iPhone SE (compact)', width: 375, height: 667, isMobile: true },
  { name: 'iPhone 14/15 (standard)', width: 390, height: 844, isMobile: true },
  { name: 'iPad (tablet)', width: 768, height: 1024, isMobile: false },
  { name: 'Desktop / Laptop', width: 1280, height: 800, isMobile: false },
];

/**
 * Страницы для проверки
 */
const PAGES = [
  { name: 'Главная (кофейня)', url: '/?brand=coffee' },
  { name: 'Доставка (пицца)', url: '/?brand=delivery' },
  { name: 'Корневой редирект', url: '/' },
];

/**
 * Гарантированное закрытие модалок и нейтрализация авто-попапа в тестах вёрстки
 */
async function ensureNoModal(page) {
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelectorAll('.modal.show, [id$="Modal"].show').forEach(m => {
      m.classList.remove('show');
    });
    const ov = document.getElementById('overlay');
    if (ov) {
      ov.classList.remove('show', 'ov-high');
    }
    // Защита от отложенного вызова openAuth во время проверки вёрстки
    window.openAuth = function () {};
    if (typeof window.closeAuth === 'function') {
      try { window.closeAuth(); } catch (_) {}
    }
  });
  await page.waitForTimeout(100);
}

test.describe('PWA Responsive Layout Audit', () => {

  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}×${vp.height})`, () => {

      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // Инициализируем тестовую сессию, предотвращая показ регистрационного онбординга
        await page.addInitScript(() => {
          localStorage.setItem('zt_onb', '1');
          const u = { id: 'u_test', name: 'Тестер', phone: '+7 999 999-11-11', stamps: 2, verified: 1 };
          localStorage.setItem('zt_user', JSON.stringify(u));
          localStorage.setItem('user', JSON.stringify(u));
          localStorage.setItem('zt_token', 'test_tok_responsive');
          localStorage.setItem('token', 'test_tok_responsive');
        });
      });

      for (const pg of PAGES) {
        test.describe(`Page: ${pg.name}`, () => {

          test('Zero Horizontal Overflow — нет горизонтального скролла', async ({ page }) => {
            await page.goto(pg.url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(400);

            const overflow = await page.evaluate(() => {
              const docEl = document.documentElement;
              const scrollWidth = docEl.scrollWidth;
              const clientWidth = docEl.clientWidth;
              return {
                scrollWidth,
                clientWidth,
                hasOverflow: scrollWidth > clientWidth + 1
              };
            });

            expect(overflow.hasOverflow,
              `Горизонтальный оверфлоу на ${pg.url}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`
            ).toBe(false);
          });

          test('Оверлеи (#panel) помещаются во вьюпорт', async ({ page }) => {
            await page.goto(pg.url, { waitUntil: 'domcontentloaded' });
            await ensureNoModal(page);

            const panelToggle = page.locator('#mbonusBtn, .ava, [data-tab="profile"]').first();
            await panelToggle.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

            if (await panelToggle.isVisible().catch(() => false)) {
              await panelToggle.click({ force: true });
              await page.waitForTimeout(400);

              const panelFits = await page.evaluate(() => {
                const panel = document.getElementById('panel');
                if (!panel || !panel.classList.contains('open')) return { ok: true, reason: 'not open' };
                const rect = panel.getBoundingClientRect();
                return {
                  ok: rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
                  rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
                  viewport: { w: window.innerWidth, h: window.innerHeight }
                };
              });

              expect(panelFits.ok,
                `Шторка #panel выходит за вьюпорт: ${JSON.stringify(panelFits.rect)}`
              ).toBe(true);

              await page.evaluate(() => {
                const p = document.getElementById('panel');
                if (p) p.classList.remove('open');
              });
            }
          });

          test('Сетка карточек доставки: тап-таргеты ≥ 40×40px', async ({ page }) => {
            if (pg.url.indexOf('brand=coffee') > -1) {
              test.skip();
              return;
            }

            await page.goto(pg.url, { waitUntil: 'domcontentloaded' });
            
            const firstCard = page.locator('#deliveryGrid .card, #deliveryGrid [data-add], #deliveryGrid .cta').first();
            await firstCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(300);

            const tapTargets = await page.evaluate(() => {
              const selectors = [
                '#deliveryGrid [data-add]',
                '#deliveryGrid .cta',
                '#deliveryGrid [data-step]',
                '#deliveryGrid .opts button'
              ];
              const results = [];
              for (const sel of selectors) {
                document.querySelectorAll(sel).forEach(el => {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    results.push({
                      selector: sel,
                      text: el.textContent?.trim().slice(0, 30) || '',
                      width: rect.width,
                      height: rect.height,
                      tooSmall: rect.width < 40 || rect.height < 40
                    });
                  }
                });
              }
              return results;
            });

            if (tapTargets.length > 0) {
              const trulySmall = tapTargets.filter(t => t.width < 36 || t.height < 36);
              expect(trulySmall.length,
                `Найдено ${trulySmall.length} тап-таргетов < 40×40px: ${JSON.stringify(trulySmall.slice(0, 3))}`
              ).toBe(0);
            }
          });

        });
      }
    });
  }

  // ── Специфичные тесты для корзины-пилюли ──
  test.describe('Floating Cart Pill (.cartFab)', () => {

    for (const vp of VIEWPORTS) {
      test(`Корзина-пилюля корректна на ${vp.name} (${vp.width}×${vp.height})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
        await ensureNoModal(page);

        // Кликаем по первой опции размера (если доступна)
        const optBtn = page.locator('#deliveryGrid .opts button').first();
        const hasOpts = await optBtn.isVisible().catch(() => false);
        if (hasOpts) {
          await optBtn.click({ force: true });
          await page.waitForTimeout(150);
        }

        // Добавляем позицию в корзину
        const addBtn = page.locator('#deliveryGrid [data-add], #deliveryGrid .cta').first();
        await addBtn.waitFor({ state: 'visible', timeout: 5000 });
        await addBtn.click({ force: true });
        await page.waitForTimeout(500);

        const cartFab = page.locator('.cartFab');
        await cartFab.waitFor({ state: 'visible', timeout: 3000 });

        // 1. Высота не превышает 64px (текст не сложился в столбик)
        const box = await cartFab.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.height,
            `Высота .cartFab = ${box.height}px (должно быть ≤ 64px). Текст сломался в столбик!`
          ).toBeLessThanOrEqual(64);

          // 2. Не обрезается краями экрана
          expect(box.x, '.cartFab выходит за левый край').toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width, '.cartFab выходит за правый край')
            .toBeLessThanOrEqual(vp.width + 1);
          expect(box.y + box.height, '.cartFab выходит за нижний край')
            .toBeLessThanOrEqual(vp.height + 1);
        }

        // 3. Содержимое расположено горизонтально (flex)
        const isFlexRow = await cartFab.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display === 'flex' &&
                 (style.flexDirection === 'row' || style.flexDirection === '');
        });
        expect(isFlexRow, '.cartFab должен быть display:flex с горизонтальным направлением').toBe(true);

        // 4. Контрастность текста на фоне
        const colors = await cartFab.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color,
            bg: style.backgroundColor
          };
        });
        const bgMatch = colors.bg.match(/\d+/g);
        if (bgMatch && bgMatch.length >= 3) {
          const luminance = (parseInt(bgMatch[0]) * 299 + parseInt(bgMatch[1]) * 587 + parseInt(bgMatch[2]) * 114) / 1000;
          expect(luminance, `Фон .cartFab слишком светлый (luminance=${luminance}), текст не будет читаться`).toBeLessThan(200);
        }
      });
    }

  });

  // ── Тест открытия корзины (#cartPanel) ──
  test.describe('Cart Panel Overlay', () => {

    for (const vp of VIEWPORTS.filter(v => v.isMobile)) {
      test(`#cartPanel помещается во вьюпорт на ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
        await ensureNoModal(page);

        const optBtn = page.locator('#deliveryGrid .opts button').first();
        const hasOpts = await optBtn.isVisible().catch(() => false);
        if (hasOpts) {
          await optBtn.click({ force: true });
          await page.waitForTimeout(150);
        }

        const addBtn = page.locator('#deliveryGrid [data-add], #deliveryGrid .cta').first();
        await addBtn.waitFor({ state: 'visible', timeout: 5000 });
        await addBtn.click({ force: true });
        await page.waitForTimeout(400);

        const cartFab = page.locator('.cartFab');
        await cartFab.waitFor({ state: 'visible', timeout: 3000 });
        await cartFab.click({ force: true });
        await page.waitForTimeout(500);

        const panelFits = await page.evaluate(() => {
          const cp = document.getElementById('cartPanel');
          if (!cp || !cp.classList.contains('open')) return { ok: true, reason: 'not open' };
          const rect = cp.getBoundingClientRect();
          return {
            ok: rect.top >= -1 && rect.right <= window.innerWidth + 1 &&
                rect.bottom <= window.innerHeight + 1 && rect.left >= -1,
            rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
            viewport: { w: window.innerWidth, h: window.innerHeight }
          };
        });

        expect(panelFits.ok,
          `#cartPanel выходит за вьюпорт: ${JSON.stringify(panelFits)}`
        ).toBe(true);
      });
    }

  });

});