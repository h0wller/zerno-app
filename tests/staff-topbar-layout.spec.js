import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function mockStaffSession(page, role = 'admin') {
  await page.addInitScript((staffRole) => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'playwright-staff-layout-token');
    localStorage.setItem('zt_role', staffRole);
    sessionStorage.setItem('splashDone', '1');
  }, role);
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const customer = {
      id: 'staff-layout-test',
      name: 'Staff Layout Test',
      phone: '+70000000000',
      role,
      verified: 1,
      cups: 0,
      stamps: 0,
      free: 0,
      history: [],
      qr: 'staff-layout-test'
    };
    const body = pathname === '/api/me'
      ? { customer }
      : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}

test('admin action bar spans the full mobile row with every action visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready') &&
    typeof window.syncBrandViews === 'function'
  );
  await page.evaluate(() => window.setMode('admin'));
  const bar = page.locator('#adminBar');
  await expect(bar).toBeVisible();
  await expect(page.locator('#promoToggle')).toBeVisible();
  await expect(page.locator('#dashToggle')).toBeVisible();
  await expect(page.locator('#chatsToggle2')).toBeVisible();
  const dimensions = await bar.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      children: Array.from(element.querySelectorAll(':scope > button:not([hidden])')).map(button => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, height: box.height };
      }),
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  expect(dimensions.left).toBeLessThanOrEqual(16);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth - 8);
  expect(dimensions.width).toBeGreaterThan(300);
  expect(dimensions.overflowX).toBe('visible');
  expect(dimensions.children).toHaveLength(3);
  expect(dimensions.children.every(button =>
    button.height >= 40 &&
    button.left >= dimensions.left - 1 &&
    button.right <= dimensions.right + 1
  )).toBe(true);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test('staff switcher stays in the visible menu heading and replaces the logo when menu is absent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready') &&
    typeof window.syncBrandViews === 'function'
  );

  const mode = page.locator('#modeSeg');
  const header = page.locator('header.topbar');
  const menuHead = page.locator('#deliveryView .menu-head');

  await expect(mode).toBeVisible();
  const guestLayout = await page.evaluate(() => {
    const seg = document.getElementById('modeSeg');
    const edit = document.getElementById('editToggle');
    const titleRow = seg.closest('.menu-controls-row');
    return {
      modeInMenuRow: !!titleRow && titleRow.parentElement === document.querySelector('#deliveryView .mh-top > div:first-child'),
      titleInsideRow: !!titleRow && titleRow.contains(titleRow.parentElement?.querySelector('h1')),
      searchInSecondRow: document.querySelector('#deliveryView .mh-top > .mh-right .search')?.parentElement === document.querySelector('#deliveryView .mh-top > .mh-right'),
      searchHeight: document.querySelector('#deliveryView .mh-top > .mh-right .search')?.getBoundingClientRect().height,
      supportIsSibling: document.getElementById('supportLauncherHost')?.parentElement === document.querySelector('#deliveryView .mh-top > .mh-right'),
      supportFabInsideLandmark: document.getElementById('chatFab')?.parentElement === document.getElementById('supportLauncherHost'),
      modeBeforeEdit: !!titleRow && Array.from(titleRow.children).indexOf(seg.closest('.mode-seg-slot')) < Array.from(titleRow.children).indexOf(edit),
      controlsRight: !!titleRow && Math.abs(edit.getBoundingClientRect().right-titleRow.getBoundingClientRect().right)<=2,
      modeBeforeEditGap: edit.getBoundingClientRect().left-seg.getBoundingClientRect().right,
      adminBarInMenuRow: document.getElementById('adminBar').parentElement===titleRow,
      fabVisibleForGuestView: getComputedStyle(document.getElementById('chatFab')).display !== 'none',
      railWidth: document.getElementById('deliveryRail').getBoundingClientRect().width,
      headerHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
      modeHeight: seg.getBoundingClientRect().height,
      buttons: Array.from(seg.querySelectorAll('button')).map(button => button.getBoundingClientRect().height),
      buttonWidths: Array.from(seg.querySelectorAll('button')).map(button => button.getBoundingClientRect().width),
      editBox: { width: edit.getBoundingClientRect().width, height: edit.getBoundingClientRect().height },
      editNextToRoles: !!titleRow && Array.from(titleRow.children).indexOf(edit) > Array.from(titleRow.children).indexOf(seg),
      modeScrollWidth: seg.scrollWidth,
      modeClientWidth: seg.clientWidth,
      editVisible: !edit.hidden
    };
  });
  expect(guestLayout.modeInMenuRow).toBe(true);
  expect(guestLayout.modeBeforeEdit).toBe(true);
  expect(guestLayout.controlsRight).toBe(true);
  expect(guestLayout.modeBeforeEditGap).toBeGreaterThanOrEqual(0);
  expect(guestLayout.modeBeforeEditGap).toBeGreaterThanOrEqual(8);
  expect(guestLayout.adminBarInMenuRow).toBe(false);
  expect(guestLayout.fabVisibleForGuestView).toBe(true);
  expect(guestLayout.railWidth).toBe(80);
  const supportFab = page.locator('#chatFab');
  await expect(supportFab).toBeVisible();
  // A repeated sync in the same brand/mode must preserve the currently selected panel tab.
  await page.evaluate(() => {
    window.setTab('profile');
    window.syncBrandViews();
  });
  await expect(page.locator('.tabs button[data-tab="profile"]')).toHaveAttribute('aria-selected', 'true');
  await page.evaluate(() => {
    document.documentElement.dataset.brand = 'coffee';
    window.brand = 'coffee';
    window.syncBrandViews();
  });
  await expect(supportFab).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.brand = 'delivery';
    window.brand = 'delivery';
    window.syncBrandViews();
  });
  await expect(supportFab.locator('svg')).toBeVisible();
  await expect(supportFab.locator('.chat-fab-label')).toHaveCount(0);
  // Admin-only controls belong to the explicit admin mode, not guest browsing.
  await page.evaluate(() => window.setMode('admin'));
  await expect(mode).toBeVisible();
  expect(await mode.evaluate((element) => element.parentElement.classList.contains('mode-seg-slot'))).toBe(true);
  const adminBarState = await page.evaluate(() => {
    const root = document.documentElement;
    const bar = document.getElementById('adminBar');
    return {
      roleAttribute: root.getAttribute('data-staff-role'),
      staffReady: root.hasAttribute('data-staff-ready'),
      windowMeRole: window.me && window.me.role,
      mode: window.mode,
      modeInMenuRow: !!document.getElementById('modeSeg').closest('.menu-controls-row'),
      brand: window.brand,
      rootBrand: root.getAttribute('data-brand'),
      hidden: bar.hidden,
      display: getComputedStyle(bar).display,
      actionButtons: Array.from(bar.querySelectorAll(':scope > button')).map(button => ({
        id: button.id,
        hidden: button.hidden,
        display: getComputedStyle(button).display
      }))
    };
  });
  console.log('[staff-actionbar] after brand switch', JSON.stringify(adminBarState));
  expect(adminBarState.mode).toBe('admin');
  expect(adminBarState.modeInMenuRow).toBe(true);
  expect(adminBarState.hidden, JSON.stringify(adminBarState)).toBe(false);
  await expect(page.locator('#adminBar')).toBeVisible();
  await expect(page.locator('#promoToggle')).toBeVisible();
  await expect(page.locator('#dashToggle')).toBeVisible();
  await expect(page.locator('#chatsToggle2')).toBeVisible();
  expect(guestLayout.headerHeight).toBeLessThanOrEqual(64);
  expect(guestLayout.modeHeight).toBe(32);
  expect(guestLayout.buttons).toHaveLength(4);
  expect(guestLayout.buttons.every(height => height === 32)).toBe(true);
  expect(guestLayout.buttonWidths.every(width => width > 0 && width <= 76)).toBe(true);
  expect(guestLayout.editNextToRoles).toBe(true);
  expect(guestLayout.editBox).toEqual({ width: 32, height: 32 });
  expect(guestLayout.modeScrollWidth).toBeLessThanOrEqual(guestLayout.modeClientWidth + 1);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => window.syncBrandViews());
  const desktopSupport = await page.evaluate(() => {
    const host = document.getElementById('supportLauncherHost');
    const fab = document.getElementById('chatFab');
    return {
      hostAtBody: host.parentElement === document.body,
      fabInsideLandmark: fab.parentElement === host,
      duplicateHostCount: document.querySelectorAll('#supportLauncherHost').length
    };
  });
  expect(desktopSupport).toEqual({
    hostAtBody: true,
    fabInsideLandmark: true,
    duplicateHostCount: 1
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.syncBrandViews());
  const mobileSupport = await page.evaluate(() => {
    const host = document.getElementById('supportLauncherHost');
    return {
      hostBesideSearch: host.parentElement === document.querySelector('#deliveryView .mh-right'),
      fabInsideLandmark: document.getElementById('chatFab').parentElement === host
    };
  });
  expect(mobileSupport).toEqual({ hostBesideSearch: true, fabInsideLandmark: true });

  await expect(page.locator('#deliveryRail')).toHaveClass(/rail-position-ready/);
  let railGeometry;
  try {
    await expect.poll(async () => {
      railGeometry = await page.evaluate(() => {
        const rail = document.getElementById('deliveryRail');
        const menuRow = document.querySelector('#deliveryView .menu-controls-row');
        const head = document.querySelector('#deliveryView .menu-head');
        const wrap = document.querySelector('.wrap');
        const style = getComputedStyle(rail);
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, height: box.height };
        };
        const railBox = rail.getBoundingClientRect();
        const topbarBottom = document.querySelector('header.topbar').getBoundingClientRect().bottom;
        const laneTop = Math.max(0, topbarBottom, head.getBoundingClientRect().bottom) + 12;
        const laneBottom = window.innerHeight - 12;
        const targetCenter = laneTop + Math.max(0, laneBottom - laneTop) / 2;
        const railParent = rail.parentElement;
        const railParentStyle = getComputedStyle(railParent);
        const railStyle = getComputedStyle(rail);
        return {
          gap: railBox.top - menuRow.getBoundingClientRect().bottom,
          centerDelta: Math.abs((railBox.top + railBox.height / 2) - targetCenter),
          brand: document.documentElement.dataset.brand,
          railClass: rail.className,
          railDisplay: style.display,
          railPosition: style.position,
          railInlineMarginTop: rail.style.marginTop,
          railMarginTop: style.marginTop,
          railInlineTop: rail.style.top,
          railTop: style.top,
          railInlineTransform: rail.style.transform,
          railTransform: style.transform,
          wrapBottom: wrap.getBoundingClientRect().bottom,
          canCenterWithinWrap: wrap.getBoundingClientRect().bottom >= parseFloat(style.top) + rail.offsetHeight,
          railAlignSelf: railStyle.alignSelf,
          railJustifySelf: railStyle.justifySelf,
          railGridRow: railStyle.gridRow,
          railContainingBlock: rail.parentElement.className,
          railParentHeight: railParent.getBoundingClientRect().height,
          railParentDisplay: railParentStyle.display,
          railParentAlignItems: railParentStyle.alignItems,
          railParentOverflowY: railParentStyle.overflowY,
          railOffsetTop: rail.offsetTop,
          railOffsetHeight: rail.offsetHeight,
          railScrollHeight: rail.scrollHeight,
          railClientHeight: rail.clientHeight,
          head: rect(head),
          menuRow: rect(menuRow),
          rail: rect(rail),
          wrap: rect(wrap)
        };
      });
      return railGeometry.gap;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(8);
  } catch (error) {
    throw new Error(error.message + '\\nRail diagnostics: ' + JSON.stringify(railGeometry));
  }
  expect(railGeometry.gap, JSON.stringify(railGeometry)).toBeGreaterThanOrEqual(8);
  expect(railGeometry.centerDelta, JSON.stringify(railGeometry)).toBeLessThanOrEqual(2.5);
  await test.info().attach('staff-guest-menu-row-mobile', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  await page.evaluate(() => window.setMode('cashier'));
  await expect(page.locator('#cashierView')).toBeVisible();
  await expect(mode).toBeVisible();
  const cashierLayout = await mode.evaluate((seg) => ({
    inTopbar: seg.parentElement === document.querySelector('header.topbar'),
    topbarTop: document.querySelector('header.topbar').getBoundingClientRect().top,
    topbarHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
    topbarPosition: getComputedStyle(document.querySelector('header.topbar')).position,
    modeTop: seg.getBoundingClientRect().top,
    headerBottom: document.querySelector('header.topbar').getBoundingClientRect().bottom
  }));
  expect(cashierLayout.inTopbar).toBe(true);
  expect(cashierLayout.topbarTop).toBeLessThanOrEqual(1);
  expect(cashierLayout.topbarHeight).toBeLessThanOrEqual(64);
  expect(cashierLayout.modeTop).toBeLessThanOrEqual(cashierLayout.headerBottom);
  expect(cashierLayout.topbarPosition).toBe('sticky');
  await test.info().attach('staff-cashier-topbar-mobile', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  await page.evaluate(() => window.setMode('orders'));
  await expect(page.locator('#ordersView')).toBeVisible();
  const ordersLayout = await mode.evaluate((seg) => ({
    inTopbar: seg.parentElement === document.querySelector('header.topbar'),
    topbarTop: document.querySelector('header.topbar').getBoundingClientRect().top,
    topbarHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
    modeBottom: seg.getBoundingClientRect().bottom,
    headerBottom: document.querySelector('header.topbar').getBoundingClientRect().bottom
  }));
  expect(ordersLayout.inTopbar).toBe(true);
  expect(ordersLayout.topbarTop).toBeLessThanOrEqual(1);
  expect(ordersLayout.topbarHeight).toBeLessThanOrEqual(64);
  expect(ordersLayout.modeBottom).toBeLessThanOrEqual(ordersLayout.headerBottom);
  await test.info().attach('staff-orders-topbar-mobile', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  await page.evaluate(() => window.setMode('admin'));
  await expect(mode).toBeVisible();
  const adminLayout = await mode.evaluate(element => ({
    inMenuRow: !!element.closest('.menu-controls-row'),
    menuVisible: getComputedStyle(document.getElementById('deliveryView')).display !== 'none',
    parent: element.parentElement.className
  }));
  expect(adminLayout.menuVisible).toBe(true);
  expect(adminLayout.inMenuRow).toBe(true);
  expect(adminLayout.parent).toBe('mode-seg-slot');

  await page.evaluate(() => window.setMode('guest'));
  await expect(mode).toBeVisible();
  expect(await mode.evaluate(element => element.parentElement.classList.contains('mode-seg-slot'))).toBe(true);
  expect(await page.locator('#editToggle').evaluate(element => element.parentElement.classList.contains('menu-controls-row'))).toBe(true);
});

for (const brand of ['coffee', 'delivery']) {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 }
  ]) {
    test(`${brand}: iOS PWA admin header and actions fit ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockStaffSession(page, 'admin');
      await page.goto(`/?brand=${brand}`);
      await page.waitForFunction(() =>
        window.me && window.me.role === 'admin' &&
        document.documentElement.hasAttribute('data-staff-ready') &&
        typeof window.setMode === 'function'
      );

      await page.evaluate(() => {
        document.documentElement.classList.add('is-ios-standalone');
        document.documentElement.style.setProperty('--sat', '47px');
        window.setMode('admin');
      });

      await expect(page.locator('#promoToggle')).toBeVisible();
      await expect(page.locator('#dashToggle')).toBeVisible();
      await expect(page.locator('#chatsToggle2')).toBeVisible();
      await expect(page.locator('#chatFab')).toBeVisible();

      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            x: box.x,
            right: box.right,
            y: box.y,
            width: box.width,
            height: box.height,
            display: style.display,
            visibility: style.visibility
          };
        };
        const header = document.querySelector('header.topbar');
        const headerStyle = getComputedStyle(header);
        const actions = document.getElementById('topbar-actions');
        const bar = document.getElementById('adminBar');
        const visibleButtons = Array.from(bar.querySelectorAll(':scope > button:not([hidden])'))
          .map((button) => {
            const box = button.getBoundingClientRect();
            return {
              id: button.id,
              x: box.x,
              right: box.right,
              y: box.y,
              width: box.width,
              height: box.height,
              gridRow: getComputedStyle(button).gridRowStart,
              text: button.textContent.trim()
            };
          });
        const support = document.getElementById('supportLauncherHost');
        const fab = document.getElementById('chatFab');
        const supportRect = support.getBoundingClientRect();
        const fabRect = fab.getBoundingClientRect();
        const supportRow = support.parentElement;
        const supportRowRect = supportRow.getBoundingClientRect();
        const supportRowStyle = getComputedStyle(supportRow);
        const supportTop = supportRow.closest('.mh-top');
        const supportTopRect = supportTop.getBoundingClientRect();
        const supportTopStyle = getComputedStyle(supportTop);
        const modeSlot = document.querySelector('.menu-controls-row > .mode-seg-slot');
        const modeSlotRect = modeSlot?.getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          header: {
            height: header.getBoundingClientRect().height,
            paddingTop: headerStyle.paddingTop,
            background: headerStyle.backgroundColor
          },
          venue: rect('#venueToggle'),
          brand: rect('#headerBrand'),
          actions: actions ? {
            ...rect('#topbar-actions'),
            profile: rect('#profileTopBtn')
          } : null,
          adminBar: {
            ...rect('#adminBar'),
            clientWidth: bar.clientWidth,
            scrollWidth: bar.scrollWidth,
            buttons: visibleButtons
          },
          modeSwitcher: rect('#modeSeg'),
          modeSlot: modeSlotRect ? {
            x: modeSlotRect.x,
            right: modeSlotRect.right,
            width: modeSlotRect.width,
            overflowX: getComputedStyle(modeSlot).overflowX,
            overflowY: getComputedStyle(modeSlot).overflowY
          } : null,
          modeHeading: rect('.menu-controls-row > h1'),
          modeEdit: rect('.menu-controls-row > #editToggle'),
          modeButtons: Array.from(document.querySelectorAll('#modeSeg > button')).map(button => {
            const box = button.getBoundingClientRect();
            return {
              x: box.x,
              right: box.right,
              width: box.width,
              text: button.textContent.trim(),
              hidden: button.hidden,
              display: getComputedStyle(button).display
            };
          }),
          support: {
            width: supportRect.width,
            height: supportRect.height,
            right: supportRect.right,
            fabWidth: fabRect.width,
            fabHeight: fabRect.height,
            fabTop: fabRect.top,
            fabBottom: fabRect.bottom,
            fabInsideHost: fab.parentElement === support,
            rowTop: supportRowRect.top,
            rowHeight: supportRowRect.height,
            rowClientHeight: supportRow.clientHeight,
            rowOverflowY: supportRowStyle.overflowY,
            hostBottom: supportRect.bottom,
            rowBottom: supportRowRect.bottom,
            topHeight: supportTopRect.height,
            topOverflowY: supportTopStyle.overflowY
          }
        };
      });

      expect.soft(layout.header.height, JSON.stringify(layout.header)).toBe(60);
      expect.soft(layout.header.paddingTop, JSON.stringify(layout.header)).toBe('4px');
      expect.soft(layout.venue.width, JSON.stringify(layout.venue)).toBeGreaterThanOrEqual(52);
      expect.soft(layout.venue.height, JSON.stringify(layout.venue)).toBeGreaterThanOrEqual(48);
      expect.soft(layout.actions, 'profile and bonus actions must use the dedicated right-hand grid cell').not.toBeNull();
      expect.soft(layout.actions.profile.right, JSON.stringify(layout.actions)).toBeLessThanOrEqual(viewport.width - 10);
      expect.soft(Math.abs(
        (layout.brand.x + layout.brand.width / 2) - viewport.width / 2
      ), JSON.stringify(layout.brand)).toBeLessThanOrEqual(2);

      expect.soft(layout.adminBar.x, JSON.stringify(layout.adminBar)).toBeLessThanOrEqual(16);
      expect.soft(layout.adminBar.right, JSON.stringify(layout.adminBar)).toBeLessThanOrEqual(viewport.width - 8);
      expect.soft(layout.adminBar.buttons).toHaveLength(3);
      expect.soft(new Set(layout.adminBar.buttons.map(button => Math.round(button.y))).size,
        JSON.stringify(layout.adminBar.buttons)).toBe(1);
      expect.soft(layout.adminBar.buttons.every(button => button.width >= (viewport.width <= 350 ? 80 : 90)),
        JSON.stringify(layout.adminBar.buttons)).toBe(true);
      expect.soft(layout.adminBar.buttons.every(button =>
        button.height >= 40 &&
        button.gridRow === '1' &&
        button.x >= layout.adminBar.x - 1 &&
        button.right <= layout.adminBar.right + 1
      ), JSON.stringify(layout.adminBar)).toBe(true);
      expect.soft(layout.adminBar.scrollWidth, JSON.stringify(layout.adminBar))
        .toBeLessThanOrEqual(layout.adminBar.clientWidth + 1);

      expect.soft(layout.modeSlot, 'role switcher must have an unclipped full-width slot')
        .not.toBeNull();
      expect.soft(layout.modeSlot.width, JSON.stringify(layout.modeSlot))
        .toBeGreaterThanOrEqual(viewport.width <= 350 ? 148 : 193);
      expect.soft(layout.modeSlot.x, JSON.stringify({ heading: layout.modeHeading, slot: layout.modeSlot }))
        .toBeGreaterThanOrEqual(layout.modeHeading.right + 3);
      expect.soft(layout.modeSlot.right, JSON.stringify({ slot: layout.modeSlot, edit: layout.modeEdit }))
        .toBeLessThanOrEqual(layout.modeEdit.x - 3);
      expect.soft(layout.modeSwitcher.width, JSON.stringify(layout.modeSwitcher))
        .toBeGreaterThanOrEqual(viewport.width <= 350 ? 148 : 193);
      expect.soft(layout.modeButtons.map(button => button.text))
        .toEqual(['Гость', 'Кассир', 'Заказы', 'Админ']);
      expect.soft(layout.modeButtons.every(button =>
        !button.hidden &&
        button.display !== 'none' &&
        button.width >= (viewport.width <= 350 ? 36 : 46) &&
        button.x >= layout.modeSlot.x - 1 &&
        button.right <= layout.modeSlot.right + 1
      ), JSON.stringify({ modeSlot: layout.modeSlot, modeButtons: layout.modeButtons })).toBe(true);

      expect.soft(layout.support.width).toBe(44);
      expect.soft(layout.support.height).toBe(44);
      expect.soft(layout.support.fabWidth).toBe(44);
      expect.soft(layout.support.fabHeight).toBe(44);
      expect.soft(layout.support.fabInsideHost).toBe(true);
      expect.soft(layout.support.rowHeight, JSON.stringify(layout.support)).toBeGreaterThanOrEqual(44);
      expect.soft(layout.support.rowClientHeight, JSON.stringify(layout.support)).toBeGreaterThanOrEqual(44);
      expect.soft(layout.support.rowOverflowY, JSON.stringify(layout.support)).toBe('visible');
      expect.soft(layout.support.topHeight, JSON.stringify(layout.support)).toBeGreaterThanOrEqual(80);
      expect.soft(layout.support.topOverflowY, JSON.stringify(layout.support)).toBe('visible');
      expect.soft(layout.support.fabTop, JSON.stringify(layout.support))
        .toBeGreaterThanOrEqual(layout.support.rowTop - 1);
      expect.soft(layout.support.fabBottom, JSON.stringify(layout.support))
        .toBeLessThanOrEqual(layout.support.rowBottom + 1);
      expect.soft(layout.support.hostBottom, JSON.stringify(layout.support))
        .toBeLessThanOrEqual(layout.support.rowBottom + 1);
      expect.soft(layout.support.right).toBeLessThanOrEqual(viewport.width - 8);
      expect.soft(layout.documentWidth).toBeLessThanOrEqual(viewport.width + 1);

      await page.evaluate(() => document.getElementById('adminBar').scrollTo({ left: 0 }));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(80);
      await page.evaluate(() => document.querySelector('.toasts')?.remove());
      await testInfo.attach(`${brand}-staff-pwa-${viewport.width}px`, {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });
      await page.locator('#adminBar').evaluate((element) => {
        element.scrollTo({ left: 0, behavior: 'instant' });
      });
    });
  }
}
