import { test, expect } from '@playwright/test';

test('simple delivery categories reserve description and composition slots', async ({ page }) => {
  await page.route('**/dmenu**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [
        {
          id: 'drink-with-desc',
          section: 'delivery',
          cat: 'drinks',
          e: '🥤',
          name: 'Морс ягодный',
          desc: 'Домашний морс из клюквы и чёрной смородины',
          price: 150,
          vol: '0,5 л',
          on: 1,
          opts: [],
          comp: [],
        },
        {
          id: 'drink-without-desc',
          section: 'delivery',
          cat: 'drinks',
          e: '🥤',
          name: 'Вода',
          desc: '',
          price: 90,
          vol: '0,5 л',
          on: 1,
          opts: [],
          comp: [],
        },
      ],
    }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  const response = page.waitForResponse(res =>
    new URL(res.url()).pathname.replace(/\/+$/, '').endsWith('/dmenu')
  );
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  expect((await response).ok()).toBe(true);

  await page.locator('#deliveryRail button[data-dcat="drinks"]').click();
  const cards = page.locator('#deliveryGrid .card[data-product-id]');
  await expect(cards).toHaveCount(2, { timeout: 10000 });

  const metrics = await cards.evaluateAll(elements => elements.map(card => {
    const desc = card.querySelector('.desc');
    const composition = card.querySelector('.comp');
    return {
      id: card.dataset.productId,
      stable: card.classList.contains('stable-meta-card'),
      cardHeight: card.getBoundingClientRect().height,
      descriptionHeight: desc?.getBoundingClientRect().height ?? 0,
      descriptionHidden: desc?.getAttribute('aria-hidden') === 'true',
      compositionHeight: composition?.getBoundingClientRect().height ?? 0,
      compositionHidden: composition?.getAttribute('aria-hidden') === 'true',
    };
  }));

  expect(metrics.every(item => item.stable), 'simple drinks use the stable metadata card contract').toBe(true);
  expect(metrics.every(item => item.descriptionHeight > 0), 'both cards reserve a description slot').toBe(true);
  expect(metrics.every(item => item.compositionHeight >= 100), 'both cards reserve a composition slot').toBe(true);
  expect(metrics.find(item => item.id === 'drink-without-desc')?.descriptionHidden).toBe(true);
  expect(metrics.every(item => item.compositionHidden), 'empty composition slots remain hidden from assistive technology').toBe(true);
  expect(Math.abs(metrics[0].cardHeight - metrics[1].cardHeight),
    'missing text and composition do not shrink one card in the first row').toBeLessThanOrEqual(1);
});
