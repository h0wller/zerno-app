import { test, expect } from '@playwright/test';

const CASES = [
  { brand: 'coffee', head: '#menuView .menu-head', rail: '#rail', tickerBg: 'rgb(18, 58, 107)' },
  { brand: 'delivery', head: '#deliveryView .menu-head', rail: '#deliveryRail', tickerBg: 'rgb(58, 42, 28)' },
];

const VIEWPORTS = [
  { name: 'narrow mobile', width: 320, height: 740 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const brand of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.brand}: menu header geometry and viewport-centered rail at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
      if (brand.brand === 'delivery' && viewport.width === 390) {
        await page.addStyleTag({ content: ':root { --sat: 47px; }' });
      }

      const menuHead = page.locator(brand.head);
      const rail = page.locator(brand.rail);
      const ticker = page.locator('.ticker');

      await expect(menuHead).toBeVisible({ timeout: 10000 });
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail).toHaveClass(/rail-position-ready/);
      await expect(ticker).toHaveCSS('display', 'flex');
      const topbar = page.locator('header.topbar');
      if (viewport.width <= 820) {
        await expect(topbar).toHaveCSS('border-bottom-width', '0px');
      }
      const initialRail = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector).getBoundingClientRect();
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const topbar = document.querySelector('header.topbar').getBoundingClientRect();
        const clearanceTop = Math.max(0, head.bottom, topbar.bottom) + 12;
        const targetCenter = (clearanceTop + window.innerHeight - 12) / 2;
        return {
          centerDelta: Math.abs((rail.top + rail.height / 2) - targetCenter),
          headGap: rail.top - head.bottom,
          topbarGap: rail.top - topbar.bottom,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });
      expect(initialRail.centerDelta).toBeLessThanOrEqual(2);
      expect(initialRail.headGap, 'rail must start below the menu title and search').toBeGreaterThanOrEqual(8);
      expect(initialRail.topbarGap, 'rail must not overlap the topbar').toBeGreaterThanOrEqual(8);
      await expect.poll(() => ticker.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 }).toBe(brand.tickerBg);

      const layout = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector);
        const railEl = document.querySelector(railSelector);
        const wrap = document.querySelector('.wrap');
        const wrapRect = wrap.getBoundingClientRect();
        const wrapStyle = getComputedStyle(wrap);
        const headRect = head.getBoundingClientRect();
        const railRect = railEl.getBoundingClientRect();
        return {
          headLeft: headRect.left,
          headRight: headRect.right,
          railTop: railRect.top,
          headBottom: headRect.bottom,
          contentLeft: wrapRect.left + parseFloat(wrapStyle.borderLeftWidth) + parseFloat(wrapStyle.paddingLeft),
          contentRight: wrapRect.right - parseFloat(wrapStyle.borderRightWidth) - parseFloat(wrapStyle.paddingRight),
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });

      if (viewport.width <= 820) {
        expect(Math.abs(layout.headLeft - layout.contentLeft), 'mobile menu-head starts at the left edge of the complete menu area').toBeLessThanOrEqual(1);
        expect(Math.abs(layout.headRight - layout.contentRight), 'mobile menu-head spans rail and content columns').toBeLessThanOrEqual(1);
      }
      expect(layout.documentScrollWidth, 'menu-head must not create horizontal page overflow').toBeLessThanOrEqual(layout.documentWidth + 1);

      const tickerLayout = await page.evaluate(() => {
        const tickerEl = document.querySelector('.ticker');
        const viewportEl = tickerEl.querySelector('.tickerViewport');
        const trackEl = tickerEl.querySelector('#tickerTrack');
        const topbarEl = document.querySelector('header.topbar');
        return {
          tickerWidth: tickerEl.getBoundingClientRect().width,
          viewportWidth: viewportEl.getBoundingClientRect().width,
          tickerTop: tickerEl.getBoundingClientRect().top,
          topbarBottom: topbarEl.getBoundingClientRect().bottom,
          tickerBackground: getComputedStyle(tickerEl).backgroundColor,
          trackBackground: getComputedStyle(trackEl).backgroundColor,
          trackWidth: trackEl.getBoundingClientRect().width,
        };
      });
      expect(tickerLayout.viewportWidth).toBeCloseTo(tickerLayout.tickerWidth, 0);
      expect(tickerLayout.tickerBackground).toBe(brand.tickerBg);
      expect(tickerLayout.trackBackground).toBe('rgba(0, 0, 0, 0)');
      expect(tickerLayout.trackWidth).toBeGreaterThanOrEqual(tickerLayout.viewportWidth);
      expect(Math.abs(tickerLayout.tickerTop - tickerLayout.topbarBottom)).toBeLessThanOrEqual(1);

      await page.evaluate(() => window.scrollTo(0, 500));
      await expect.poll(() => page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector).getBoundingClientRect();
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const topbar = document.querySelector('header.topbar').getBoundingClientRect();
        const clearanceTop = Math.max(0, head.bottom, topbar.bottom) + 12;
        const targetCenter = (clearanceTop + window.innerHeight - 12) / 2;
        return Math.abs((rail.top + rail.height / 2) - targetCenter);
      }, { headSelector: brand.head, railSelector: brand.rail }), { timeout: 5000 }).toBeLessThanOrEqual(2);
      const afterScroll = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector).getBoundingClientRect();
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const topbar = document.querySelector('header.topbar').getBoundingClientRect();
        return {
          railTop: rail.top,
          menuHeadBottom: head.bottom,
          topbarBottom: topbar.bottom,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });
      expect(afterScroll.railTop).toBeGreaterThanOrEqual(Math.max(
        0,
        afterScroll.menuHeadBottom,
        afterScroll.topbarBottom
      ) + 8);
    });
  }
}


test('coffee menu heading includes the full marina tagline on mobile and desktop', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('#menuView .menu-head h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/^Меню\s+кофейня на берегу моря$/);

    const geometry = await heading.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewportWidth: document.documentElement.clientWidth,
        text: element.innerText.replace(/\s+/g, ' ').trim(),
      };
    });
    expect(geometry.text).toMatch(/^Меню\s+кофейня на берегу моря$/i);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  }
});


function relativeLuminance(color) {
  const channels = color.match(/[\\d.]+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const brandName of ['coffee', 'delivery']) {
  test(brandName + ': mobile menu header is compact and staff actions stay in a single scrollable row', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brandName, { waitUntil: 'domcontentloaded' });

    const view = page.locator(brandName === 'coffee' ? '#menuView' : '#deliveryView');
    const menuHead = view.locator('.menu-head');
    await expect(menuHead).toBeVisible();
    await expect(menuHead.locator('h1 em')).toBeHidden();
    await expect(menuHead.locator('.upd')).toBeHidden();

    const adminBar = page.locator('#adminBar');
    await adminBar.evaluate(element => {
      element.hidden = false;
      element.querySelectorAll('button').forEach(button => { button.hidden = false; });
    });
    await expect(adminBar).toBeVisible();

    const layout = await page.evaluate(({ brandName }) => {
      const view = document.querySelector(brandName === 'coffee' ? '#menuView' : '#deliveryView');
      const menuHead = view.querySelector('.menu-head');
      const adminBar = document.querySelector('#adminBar');
      const edit = document.querySelector('#editToggle');
      const actions = document.querySelector('.topbar-actions');
      const bonus = document.querySelector('#mbonusBtn');
      const profile = document.querySelector('#profileTopBtn');
      const mode = document.querySelector('#modeSeg');
      const buttons = Array.from(adminBar.querySelectorAll('button:not([hidden])'));
      const rows = new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top)));
      const rail = document.querySelector(brandName === 'coffee' ? '#rail' : '#deliveryRail');
      const rect = element => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const modeButton = mode.querySelector('button.on');
      return {
        menuHead: rect(menuHead),
        adminBar: rect(adminBar),
        adminDisplay: getComputedStyle(adminBar).display,
        adminWrap: getComputedStyle(adminBar).flexWrap,
        adminOverflowX: getComputedStyle(adminBar).overflowX,
        adminButtonRows: rows.size,
        editInMenu: !!(edit && edit.closest('.menu-head')),
        editDisplay: edit ? getComputedStyle(edit).display : null,
        headerActions: actions ? rect(actions) : null,
        bonus: rect(bonus),
        bonusPosition: getComputedStyle(bonus).position,
        bonusParent: bonus.parentElement.className,
        profile: rect(profile),
        modeHiddenForGuest: mode.hidden,
        modeButtonContrast: modeButton ? contrastRatio(getComputedStyle(modeButton).backgroundColor, getComputedStyle(mode).backgroundColor) : null,
        railTop: rect(rail).top,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      };
    }, { brandName });

    expect(layout.adminDisplay).toBe('flex');
    expect(layout.adminWrap).toBe('nowrap');
    expect(layout.adminOverflowX).toBe('auto');
    expect(layout.adminButtonRows).toBe(1);
    expect(layout.editInMenu).toBe(true);
    expect(layout.headerActions).not.toBeNull();
    expect(layout.bonusParent).toBe('topbar-actions');
    expect(layout.bonusPosition).toBe('static');
    expect(layout.modeHiddenForGuest).toBe(true);
    expect(layout.railTop).toBeGreaterThanOrEqual(layout.menuHead.bottom + 8);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

    await testInfo.attach(brandName + '-mobile-menu-admin-row-390px', {
      body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
      contentType: 'image/png'
    });
  });
}

test('coffee admin mode has a clearly distinguishable active mode tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const mode = page.locator('#modeSeg');
  await mode.evaluate(element => {
    element.hidden = false;
    element.innerHTML = '<button type="button">Гость</button><button type="button">Кассир</button><button type="button">Заказы</button><button type="button" class="on">Админ</button>';
  });
  const contrast = await mode.evaluate(element => {
    const active = element.querySelector('button.on');
    const background = getComputedStyle(active).backgroundColor;
    const surface = getComputedStyle(element).backgroundColor;
    return contrastRatio(background, surface);
  });
  expect(contrast).toBeGreaterThanOrEqual(3);
  await expect(mode.locator('button.on')).toHaveCSS('color', 'rgb(18, 58, 107)');
});
