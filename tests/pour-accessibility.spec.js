import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.describe('Pour accessibility audit — delivery brand', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery');
    await expect(page.locator('#dSearch')).toBeVisible();
  });

  test('delivery search has a persistent label, 40px height and visible boundary', async ({ page }) => {
    const input = page.locator('#dSearch');
    await expect(page.locator('label[for="dSearch"]')).toHaveText('Поиск по меню доставки');

    const metrics = await input.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const search = element.closest('.search');
      const style = getComputedStyle(search);
      return {
        inputHeight: box.height,
        containerHeight: search.getBoundingClientRect().height,
        boxSizing: getComputedStyle(element).boxSizing,
        borderColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
      };
    });

    expect(metrics.inputHeight).toBe(36);
    expect(metrics.containerHeight).toBe(40);
    expect(contrastRatio(metrics.borderColor, metrics.backgroundColor)).toBeGreaterThanOrEqual(3);
  });

  test('role controls stay compact while search, filters and header taps remain comfortable', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const probe = document.createElement('button');
      probe.textContent = 'Тест';
      const modeSeg = document.getElementById('modeSeg');
      const edit = document.getElementById('editToggle');
      const modeParent = modeSeg.parentNode;
      const modeNext = modeSeg.nextSibling;
      const editParent = edit.parentNode;
      const editNext = edit.nextSibling;
      const wasModeHidden = modeSeg.hidden;
      const wasEditHidden = edit.hidden;
      const fixture = document.createElement('div');
      fixture.className = 'menu-head';
      const row = document.createElement('div');
      row.className = 'menu-controls-row';
      const slot = document.createElement('div');
      slot.className = 'mode-seg-slot';
      fixture.appendChild(row);
      row.appendChild(slot);
      slot.appendChild(modeSeg);
      row.appendChild(edit);
      document.body.appendChild(fixture);
      modeSeg.hidden = false;
      edit.hidden = false;
      modeSeg.appendChild(probe);
      const modeHeight = probe.getBoundingClientRect().height;
      const roleButtonRect = modeSeg.querySelector('button')?.getBoundingClientRect();
      const roleButton = {
        width: roleButtonRect?.width ?? 0,
        height: roleButtonRect?.height ?? 0
      };
      const modeButtonHeight = roleButton.height;
      probe.remove();
      const editMinHeight = parseFloat(getComputedStyle(edit).minHeight);
      if (modeNext && modeNext.parentNode === modeParent) modeParent.insertBefore(modeSeg, modeNext);
      else modeParent.appendChild(modeSeg);
      if (editNext && editNext.parentNode === editParent) editParent.insertBefore(edit, editNext);
      else editParent.appendChild(edit);
      modeSeg.hidden = wasModeHidden;
      edit.hidden = wasEditHidden;
      fixture.remove();

      return {
        modeHeight,
        modeButtonHeight,
        editMinHeight,
        subchips: Array.from(document.querySelectorAll('#deliverySubFilter .subchip'))
          .map((element) => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width })),
        profile: document.getElementById('profileTopBtn').getBoundingClientRect().toJSON(),
        scrollTop: document.getElementById('scrollTopBtn').getBoundingClientRect().toJSON(),
        menuHead: (() => { const element = document.querySelector('#deliveryView .menu-head'); const style = getComputedStyle(element); return { height: element.getBoundingClientRect().height, maxHeight: style.maxHeight, overflow: style.overflow }; })(),
        search: document.querySelector('#deliveryView .mh-right .search').getBoundingClientRect().height,
        venue: document.getElementById('venueToggle').getBoundingClientRect().toJSON(),
        supportHost: document.getElementById('supportLauncherHost').getBoundingClientRect().toJSON(),
        support: document.getElementById('chatFab').getBoundingClientRect().toJSON(),
        addButton: (() => { const el = document.querySelector('#deliveryGrid .cta[data-add]'); const r = el.getBoundingClientRect(); const row = el.closest('.steprow').getBoundingClientRect(); return { width:r.width, rowWidth:row.width, height:r.height }; })(),
        activeChip: (() => { const el = document.querySelector('#deliverySubFilter .subchip.on'); const s=getComputedStyle(el); return { bg:s.backgroundColor, color:s.color }; })(),
        roleButton,
      };
    });

    expect(metrics.modeHeight).toBe(32);
    expect(metrics.modeButtonHeight).toBe(32);
    expect(metrics.editMinHeight).toBe(32);
    expect(metrics.subchips.length).toBeGreaterThan(0);
    expect(metrics.subchips.every((chip) => chip.height === 40 && chip.width >= 58),
      `subchip geometry must remain at least 58×40px: ${JSON.stringify(metrics.subchips)}`).toBe(true);
    expect(metrics.profile.width).toBe(44);
    expect(metrics.profile.height).toBe(44);
    expect(metrics.venue.width).toBeGreaterThanOrEqual(44);
    expect(metrics.venue.height).toBeGreaterThanOrEqual(44);
    expect(metrics.supportHost.width).toBe(44);
    expect(metrics.supportHost.height).toBe(44);
    expect(metrics.support.width).toBe(44);
    expect(metrics.support.height).toBe(44);
    expect(metrics.scrollTop.width).toBe(32);
    expect(metrics.scrollTop.height).toBe(32);
    expect(metrics.menuHead.maxHeight).toBe('100px');
    expect(metrics.menuHead.overflow).not.toBe('hidden');
    expect(metrics.search).toBe(40);
    expect(metrics.addButton.width).toBeGreaterThanOrEqual(metrics.addButton.rowWidth - 1);
    expect(metrics.activeChip.bg).toBe('rgb(192, 59, 42)');
    expect(metrics.activeChip.color).toBe('rgb(255, 255, 255)');
    expect(metrics.roleButton.height).toBe(32);
    expect(metrics.roleButton.width).toBeGreaterThan(metrics.roleButton.height);
  });

  test('menu row stays compact and admin keeps the switcher with the visible menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === '/api/me'
        ? {
            customer: {
              id: 'accessibility-layout-admin',
              name: 'Accessibility Layout Admin',
              phone: '+70000000001',
              role: 'admin',
              verified: 1,
              qr: 'accessibility-layout-admin',
              cups: 0,
              stamps: 0,
              free: 0,
              history: []
            }
          }
        : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'playwright-accessibility-admin-token');
      localStorage.setItem('zt_role', 'admin');
    });
    await page.reload();
    await page.waitForFunction(() =>
      window.me && window.me.role === 'admin' &&
      document.documentElement.hasAttribute('data-staff-ready')
    );

    const menuMetrics = await page.evaluate(() => {
      const header = document.querySelector('header.topbar').getBoundingClientRect();
      const seg = document.getElementById('modeSeg');
      const row = seg.closest('.menu-controls-row');
      const edit = document.getElementById('editToggle');
      return {
        headerHeight: header.height,
        modeInMenuRow: !!row && row.parentElement === document.querySelector('#deliveryView .mh-top > div:first-child'),
        editInMenuRow: edit.parentElement === row,
        rowHeight: row.getBoundingClientRect().height,
        buttonHeights: Array.from(seg.querySelectorAll('button')).map(button => button.getBoundingClientRect().height)
      };
    });
    expect(menuMetrics.headerHeight).toBeLessThanOrEqual(64);
    expect(menuMetrics.modeInMenuRow).toBe(true);
    expect(menuMetrics.editInMenuRow).toBe(true);
    expect(menuMetrics.rowHeight).toBe(36);
    expect(menuMetrics.buttonHeights).toHaveLength(4);
    expect(menuMetrics.buttonHeights.every(height => height === 32)).toBe(true);

    await page.evaluate(() => window.setMode('admin'));
    const adminMetrics = await page.evaluate(() => {
      const header = document.querySelector('header.topbar').getBoundingClientRect();
      const seg = document.getElementById('modeSeg');
      const row = seg.closest('.menu-controls-row');
      return {
        headerHeight: header.height,
        modeInMenuRow: !!row && seg.parentElement.classList.contains('mode-seg-slot'),
        menuVisible: getComputedStyle(document.getElementById('deliveryView')).display !== 'none',
        rowHeight: row?.getBoundingClientRect().height,
        buttonHeights: Array.from(seg.querySelectorAll('button')).map(button => button.getBoundingClientRect().height)
      };
    });
    expect(adminMetrics.menuVisible).toBe(true);
    expect(adminMetrics.modeInMenuRow).toBe(true);
    expect(adminMetrics.headerHeight).toBeLessThanOrEqual(64);
    expect(adminMetrics.rowHeight).toBe(36);
    expect(adminMetrics.buttonHeights.every(height => height === 32)).toBe(true);
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
        modeHiddenForPublicGuest: !!document.querySelector('#modeSeg')?.hidden &&
          document.querySelector('#modeSeg').getBoundingClientRect().height === 0,
      };
    });
    expect(order.order.every((index) => index >= 0)).toBe(true);
    expect(order.order).toEqual([...order.order].sort((a, b) => a - b));
    expect(order.actionsOwnBonus).toBe(true);
    expect(order.actionsOwnProfile).toBe(true);
    expect(order.modeHiddenForPublicGuest).toBe(true);

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
