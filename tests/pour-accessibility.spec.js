import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.describe('Pour accessibility audit — delivery brand', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery');
    await expect(page.locator('#dSearch')).toBeVisible();
  });

  test('delivery search has a persistent label, 44px target and visible boundary', async ({ page }) => {
    const input = page.locator('#dSearch');
    await expect(page.locator('label[for="dSearch"]')).toHaveText('Поиск по меню доставки');

    const metrics = await input.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const search = element.closest('.search');
      const style = getComputedStyle(search);
      return {
        inputHeight: box.height,
        containerHeight: search.getBoundingClientRect().height,
        borderColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
      };
    });

    expect(metrics.inputHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.containerHeight).toBeGreaterThanOrEqual(44);
    expect(contrastRatio(metrics.borderColor, metrics.backgroundColor)).toBeGreaterThanOrEqual(3);
  });

  test('header, edit and delivery filter controls have 44px hit targets', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const probe = document.createElement('button');
      probe.textContent = 'Тест';
      const modeSeg = document.getElementById('modeSeg');
      const wasHidden = modeSeg.hidden;
      modeSeg.hidden = false;
      modeSeg.appendChild(probe);
      const modeHeight = probe.getBoundingClientRect().height;
      probe.remove();
      modeSeg.hidden = wasHidden;

      return {
        modeHeight,
        editMinHeight: parseFloat(getComputedStyle(document.getElementById('editToggle')).minHeight),
        subchips: Array.from(document.querySelectorAll('#deliverySubFilter .subchip'))
          .map((element) => element.getBoundingClientRect().height),
      };
    });

    expect(metrics.modeHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.editMinHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.subchips.length).toBeGreaterThan(0);
    expect(metrics.subchips.every((height) => height >= 44)).toBe(true);
  });

  test('mobile staff header and mode switch stay compact without shrinking 44px controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?brand=delivery');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-staff-role', 'admin');
      const modeSeg = document.getElementById('modeSeg');
      modeSeg.hidden = false;
      modeSeg.innerHTML = ['Заказы', 'Касса', 'Диспетчер', 'Админ'].map((label) =>
        '<button type="button">' + label + '</button>'
      ).join('');
    });

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header.topbar').getBoundingClientRect();
      const mode = document.getElementById('modeSeg');
      const modeBox = mode.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        headerLeft: header.left,
        headerRight: header.right,
        headerWidth: header.width,
        modeLeft: modeBox.left,
        modeRight: modeBox.right,
        modeWidth: modeBox.width,
        modeHeight: modeBox.height,
        buttonHeights: Array.from(mode.querySelectorAll('button')).map((button) => button.getBoundingClientRect().height),
      };
    });

    expect(metrics.headerLeft).toBe(0);
    expect(metrics.headerRight).toBe(metrics.viewportWidth);
    expect(metrics.headerWidth).toBe(metrics.viewportWidth);
    expect(metrics.modeLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.modeRight).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.modeWidth).toBeLessThanOrEqual(metrics.headerWidth);
    expect(metrics.modeHeight).toBe(46);
    expect(metrics.buttonHeights.every((height) => height >= 44)).toBe(true);
  });

  test('floating controls and confetti canvas have accessible landmark treatment', async ({ page }) => {
    await expect(page.locator('#fx')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#chatFab').locator('xpath=ancestor::aside[@aria-label="Поддержка"]')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Навигация по странице"] #scrollTopBtn')).toBeAttached();
  });

  test('ticker is full-bleed, loops only a complete overflowing line, and has no pause control', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      window.BRANDS.delivery.ticker = [
        'Пятница — доставка пиццы и роллов в Янтарном и ближайших посёлках',
        'Летом ежедневно с 11:00 до 22:00, зимой график зависит от дня недели',
        'Доставка обычно занимает около 45 минут после подтверждения заказа',
        'Новости, акции и специальные предложения доступны в наших каналах'
      ];
      window.applyBrandChrome(true);
    });
    const tickerBox = page.locator('.ticker');
    await expect(tickerBox).toHaveClass(/is-overflowing/);
    await expect(page.locator('#tickerToggle')).toHaveCount(0);

    const ticker = await tickerBox.evaluate((container) => {
      const track = container.querySelector('#tickerTrack');
      const viewport = container.querySelector('.tickerViewport');
      const group = track.firstElementChild;
      const trackStyle = getComputedStyle(track);
      const box = container.getBoundingClientRect();
      return {
        animationName: trackStyle.animationName,
        animationPlayState: trackStyle.animationPlayState,
        flexWrap: trackStyle.flexWrap,
        whiteSpace: getComputedStyle(group).whiteSpace,
        overflowX: getComputedStyle(container).overflowX,
        height: box.height,
        left: box.left,
        width: box.width,
        viewportWidth: viewport.clientWidth,
        groupWidth: group.getBoundingClientRect().width,
        groups: track.children.length,
        cloneHidden: track.children[1]?.getAttribute('aria-hidden')
      };
    });
    expect(ticker.animationName).toBe('zt-marquee');
    expect(ticker.flexWrap).toBe('nowrap');
    expect(ticker.whiteSpace).toBe('nowrap');
    expect(ticker.overflowX).toBe('hidden');
    expect(ticker.height).toBe(34);
    expect(ticker.left).toBe(0);
    expect(ticker.width).toBe(ticker.viewportWidth);
    expect(ticker.groupWidth).toBeGreaterThan(ticker.viewportWidth);
    expect(ticker.groups).toBe(2);
    expect(ticker.cloneHidden).toBe('true');
    expect(ticker.animationPlayState).toBe('running');

    const attachedLayout = await page.locator('header.topbar').evaluate((header) => {
      const tickerElement = document.querySelector('.ticker');
      const headerBox = header.getBoundingClientRect();
      const tickerBox = tickerElement.getBoundingClientRect();
      const controls = ['#venueToggle', '#headerBrand', '#profileTopBtn']
        .map((selector) => header.querySelector(selector).getBoundingClientRect());
      const groupLeft = Math.min(...controls.map((box) => box.left));
      const groupRight = Math.max(...controls.map((box) => box.right));
      const verticalCenters = controls.map((box) => box.top + box.height / 2);
      return {
        headerLeft: headerBox.left,
        headerRight: headerBox.right,
        headerWidth: headerBox.width,
        headerHeight: headerBox.height,
        tickerTop: tickerBox.top,
        tickerParent: tickerElement.parentElement === document.body,
        groupCenter: (groupLeft + groupRight) / 2,
        verticalCenterSpread: Math.max(...verticalCenters) - Math.min(...verticalCenters),
        viewportCenter: window.innerWidth / 2,
        headerShadow: getComputedStyle(header).boxShadow,
        borderRadius: getComputedStyle(header).borderRadius,
      };
    });
    expect(attachedLayout.tickerParent).toBe(true);
    expect(Math.abs(attachedLayout.tickerTop - attachedLayout.headerHeight)).toBeLessThanOrEqual(1);
    expect(attachedLayout.headerLeft).toBe(0);
    expect(attachedLayout.headerRight).toBe(390);
    expect(attachedLayout.headerWidth).toBe(390);
    expect(attachedLayout.headerHeight).toBeLessThanOrEqual(64);
    expect(Math.abs(attachedLayout.groupCenter - attachedLayout.viewportCenter)).toBeLessThanOrEqual(1);
    expect(attachedLayout.verticalCenterSpread).toBeLessThanOrEqual(1);
    expect(attachedLayout.headerShadow).toBe('none');
    expect(attachedLayout.borderRadius).toBe('0px');

    const order = await page.locator('header.topbar').evaluate((header) => {
      const childIndex = (selector) => Array.from(header.children).indexOf(header.querySelector(selector));
      const actions = header.querySelector('.topbar-actions');
      return {
        order: [childIndex('.venueWrap'), childIndex('#headerBrand'), childIndex('.topbar-actions')],
        actionsOwnBonus: !!(actions && actions.querySelector('#mbonusBtn')),
        actionsOwnProfile: !!(actions && actions.querySelector('#profileTopBtn')),
        modeOutsideHeader: !header.contains(document.querySelector('#modeSeg')),
      };
    });
    expect(order.order.every((index) => index >= 0)).toBe(true);
    expect(order.order).toEqual([...order.order].sort((a, b) => a - b));
    expect(order.actionsOwnBonus).toBe(true);
    expect(order.actionsOwnProfile).toBe(true);
    expect(order.modeOutsideHeader).toBe(true);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => page.locator('#tickerTrack').evaluate((track) => getComputedStyle(track).animationName)).toBe('none');
    const tickerViewport = page.locator('.tickerViewport');
    await expect(tickerViewport).toHaveCSS('overflow-x', 'auto');
    const manualScroll = await tickerViewport.evaluate((element) => {
      const before = element.scrollLeft;
      element.scrollLeft = element.scrollWidth;
      return {
        before,
        after: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(manualScroll.scrollWidth).toBeGreaterThan(manualScroll.clientWidth);
    expect(manualScroll.after).toBeGreaterThan(manualScroll.before);
    await expect(page.locator('#tickerToggle')).toHaveCount(0);
  });

  test('critical delivery text retains AAA contrast on its opaque surfaces', async ({ page }) => {
    await expect(page.locator('#venueToggle')).toBeAttached();

    const metrics = await page.evaluate(() => {
      const mode = document.getElementById('modeSeg');
      const wasHidden = mode.hidden;
      mode.hidden = false;
      const inactive = document.createElement('button');
      const active = document.createElement('button');
      active.className = 'on';
      mode.append(inactive, active);

      const rail = document.getElementById('deliveryRail');
      const railProbe = document.createElement('button');
      railProbe.className = 'on';
      rail.appendChild(railProbe);

      const ticker = document.getElementById('tickerTrack');
      const venue = document.getElementById('venueToggle');
      const arrow = venue.querySelector('.vt-arrow');
      const badge = document.querySelector('#deliveryView .menu-head h1 em');
      const update = document.getElementById('updWhenD');

      const result = {
        modeBackground: getComputedStyle(mode).backgroundColor,
        inactiveModeText: getComputedStyle(inactive).color,
        activeModeBackground: getComputedStyle(active).backgroundColor,
        activeModeText: getComputedStyle(active).color,
        tickerBackground: getComputedStyle(ticker).backgroundColor,
        tickerText: getComputedStyle(ticker).color,
        railBackground: getComputedStyle(railProbe).backgroundColor,
        railText: getComputedStyle(railProbe).color,
        venueBackground: getComputedStyle(venue).backgroundColor,
        venueText: getComputedStyle(arrow).color,
        venueArrowOpacity: getComputedStyle(arrow).opacity,
        badgeText: getComputedStyle(badge).color,
        badgeBackground: getComputedStyle(badge).backgroundColor,
        updateText: getComputedStyle(update).color,
      };

      inactive.remove();
      active.remove();
      railProbe.remove();
      mode.hidden = wasHidden;
      return result;
    });

    expect(contrastRatio(metrics.modeBackground, metrics.inactiveModeText)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(metrics.activeModeBackground, metrics.activeModeText)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(metrics.tickerBackground, metrics.tickerText)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(metrics.railBackground, metrics.railText)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(metrics.venueBackground, metrics.venueText)).toBeGreaterThanOrEqual(7);
    expect(metrics.venueArrowOpacity).toBe('1');
    const badgeSurface = compositeColor(metrics.badgeBackground, 'rgb(246, 238, 225)');
    expect(contrastRatio(badgeSurface, metrics.badgeText)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('rgb(246, 238, 225)', metrics.updateText)).toBeGreaterThanOrEqual(7);
  });

  test('keyboard focus on delivery search retains a visible indicator', async ({ page }) => {
    let reachedSearch = false;
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => ({
        id: document.activeElement && document.activeElement.id,
        outline: document.activeElement && getComputedStyle(document.activeElement).outlineStyle,
      }));
      if (active.id === 'dSearch') {
        reachedSearch = true;
        expect(active.outline).not.toBe('none');
        break;
      }
    }
    expect(reachedSearch).toBe(true);
  });
});

function compositeColor(foreground, background) {
  const fg = foreground.match(/[\d.]+/g).map(Number);
  const bg = background.match(/[\d.]+/g).map(Number);
  const alpha = fg.length > 3 ? fg[3] : 1;
  return 'rgb(' + fg.slice(0, 3).map((channel, index) =>
    Math.round(channel * alpha + bg[index] * (1 - alpha))
  ).join(', ') + ')';
}

function contrastRatio(first, second) {
  const luminance = (color) => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
