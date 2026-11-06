import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 740, name: '320px narrow mobile' },
  { width: 375, height: 812, name: '375px mobile' },
  { width: 390, height: 844, name: '390px mobile' },
];

async function installCoffeeGuest(page, stamps, free) {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.getAttribute('data-staff-ready') === '1' &&
    typeof window.setUser === 'function' &&
    typeof window.openPanel === 'function'
  )).toBe(true);
  await page.evaluate(({ stamps, free }) => {
    const customer = {
      id: 'coffee-visual-guest',
      name: 'Тестовый гость',
      phone: '+7 900 000-00-00',
      role: 'guest',
      cups: 18,
      stamps,
      free,
      qr: 'coffee-visual-guest',
      history: [],
      verified: 1
    };
    window.setUser('coffee-visual-token', customer);
    window.__profileMeReady();
    window.renderBonus();
    window.renderProfile();
    window.openPanel('bonus');
  }, { stamps, free });
  await expect(page.locator('#panel')).toHaveClass(/open/);
  await expect(page.locator('#pvBonus')).toBeVisible();
  await expect(page.locator('#bonusBox')).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test('coffee bonus panel fits without horizontal overflow at ' + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installCoffeeGuest(page, 9, 2);

    const measurements = await page.evaluate(() => {
      const panel = document.querySelector('#panel');
      const bonus = document.querySelector('#pvBonus');
      const box = document.querySelector('#bonusBox');
      const stamps = document.querySelector('#stampGrid');
      const promo = document.querySelector('#promoInput');
      const row = promo.closest('.findrow');
      const freeCard = document.querySelector('.freeCard');
      const rect = element => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const bonusRect = bonus.getBoundingClientRect();
      const overflow = [...bonus.querySelectorAll('*')].map(element => {
        const style = getComputedStyle(element);
        const r = element.getBoundingClientRect();
        return {
          selector: element.id ? '#' + element.id : element.className && typeof element.className === 'string' ? '.' + element.className.trim().replace(/\s+/g, '.') : element.tagName.toLowerCase(),
          right: r.right,
          left: r.left,
          width: r.width,
          visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
        };
      }).filter(item => item.visible && item.width > 0 && (item.left < bonusRect.left - 1 || item.right > bonusRect.right + 1));
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        panel: { client: panel.clientWidth, scroll: panel.scrollWidth },
        bonus: { client: bonus.clientWidth, scroll: bonus.scrollWidth },
        box: rect(box),
        stamps: rect(stamps),
        stampCells: [...stamps.children].map(rect),
        promo: rect(promo),
        promoRow: rect(row),
        bonusBounds: rect(bonus),
        freeCard: freeCard ? rect(freeCard) : null,
        overflow
      };
    });
    expect(measurements.documentWidth, JSON.stringify(measurements.overflow)).toBeLessThanOrEqual(viewport.width + 1);
    expect(measurements.panel.scroll, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.panel.client + 1);
    expect(measurements.bonus.scroll, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.bonus.client + 1);
    expect(measurements.overflow, JSON.stringify(measurements.overflow)).toHaveLength(0);
    expect(measurements.stampCells).toHaveLength(10);
    expect(measurements.promo.width).toBeGreaterThan(0);
    expect(measurements.promoRow.right).toBeLessThanOrEqual(measurements.bonusBounds.right + 1);
    expect(measurements.freeCard.right).toBeLessThanOrEqual(measurements.bonusBounds.right + 1);

    await testInfo.attach('coffee-bonus-' + viewport.width + 'px', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });
  });

  test('coffee first menu screen uses a quiet compact search at ' + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-brand'))).toBe('coffee');
    await expect.poll(() => page.locator('#menuView .coffee-menu-search').count()).toBe(1);
    await page.waitForFunction(() => {
      const search = document.querySelector('#menuView .coffee-menu-search');
      return search && search.querySelector('input') && getComputedStyle(search).display !== 'none';
    });
    const search = page.locator('#menuView .coffee-menu-search');
    await expect(search).toBeVisible();
    await expect(search.locator('input')).toHaveAttribute('placeholder', 'Найти напиток или десерт…');
    const sectionHeading = page.locator('#menuView .mh-top h2.vh');
    await expect(sectionHeading).toHaveText('Разделы меню');
    const headingBounds = await sectionHeading.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        position: style.position,
        width: rect.width,
        height: rect.height,
        overflow: style.overflow,
        clip: style.clip
      };
    });
    expect(headingBounds.position).toBe('absolute');
    expect(headingBounds.width).toBeLessThanOrEqual(1);
    expect(headingBounds.height).toBeLessThanOrEqual(1);
    expect(headingBounds.overflow).toBe('hidden');
    expect(headingBounds.clip).not.toBe('auto');
    await expect(page.locator('#menuView .mh-top .upd')).toBeHidden();
    await expect(page.locator('#menuView h1')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const search = document.querySelector('#menuView .coffee-menu-search');
      const head = document.querySelector('#menuView .menu-head');
      const rect = element => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height, top: r.top, bottom: r.bottom };
      };
      return {
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        search: rect(search),
        head: rect(head),
        iconVisible: getComputedStyle(search.querySelector('.search-icon')).display !== 'none'
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
    // The menu heading keeps its horizontal inset; the search stays inside that content box.
    expect(geometry.search.width).toBeGreaterThan(0);
    expect(geometry.search.left).toBeGreaterThanOrEqual(geometry.head.left);
    expect(geometry.search.right).toBeLessThanOrEqual(geometry.head.right);
    expect(geometry.search.height).toBeLessThanOrEqual(48);
    expect(geometry.search.left).toBeGreaterThanOrEqual(0);
    expect(geometry.search.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.iconVisible).toBe(true);

    await search.locator('input').fill('капучино');
    await expect(page.locator('#grid .card').filter({ hasText: 'Капучино' })).toBeVisible();
    await testInfo.attach('coffee-menu-search-' + viewport.width + 'px', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });
  });
}

test('coffee profile keeps one QR action and avoids a duplicate large QR on the profile tab', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCoffeeGuest(page, 6, 1);
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-brand'))).toBe('coffee');
  await expect(page.locator('#bonusBox')).toBeVisible();
  await expect(page.locator('#bonusCount')).toHaveText('6/10');
  await expect(page.locator('#qrOpenBonus')).toBeVisible();
  await expect(page.locator('#qrOpenProfile')).toHaveCount(0);
  await expect(page.locator('#qrMain')).toHaveCount(1);
  await expect(page.locator('#qrMini')).toHaveCount(1);

  await page.locator('#tabProfile').click();
  await expect(page.locator('#pvProfile')).toBeVisible();
  await expect(page.locator('#profileCoffeeSection')).toBeVisible();
  await expect(page.locator('#profileCoffeeSection .profile-qr-access')).toBeVisible();
  await expect(page.locator('#profileCoffeeSection .stats')).toBeHidden();
  await expect(page.locator('#profileCoffeeSection #profileStampProgress')).toBeVisible();
  await expect(page.locator('#profileCoffeeSection #profileStampsRemaining')).toBeVisible();
  await testInfo.attach('coffee-profile-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  const repeatedLargeQR = await page.locator('#profileCoffeeSection canvas').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 100 || rect.height > 100;
  });
  expect(repeatedLargeQR).toBe(false);

  await page.locator('#profileCoffeeSection [data-open-bonus-tab]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tabBonus')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#qrOpenBonus')).toBeVisible();
  await expect(page.locator('#tabBonus')).toBeFocused();

  const menuHeading = page.locator('#menuView .mh-top h2.vh');
  await expect(menuHeading).toHaveCount(1);
  await expect(menuHeading).toHaveCSS('position', 'absolute');
  await expect(menuHeading).toHaveCSS('width', '1px');
  await expect(page.locator('#menuView .mh-top .upd')).toBeHidden();
});
