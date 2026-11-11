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

test('mobile menu header has only the two requested rows', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: width === 320 ? 740 : 844 });
      await mockStaffSession(page);
      await page.goto('/?brand=' + brand);
      await page.waitForFunction(() =>
        window.me && window.me.role === 'admin' &&
        document.documentElement.hasAttribute('data-staff-ready')
      );
      await page.evaluate(() => window.setMode('admin'));
      await expect(page.locator('#adminBar')).toBeVisible();
      for (const action of ['#promoToggle', '#dashToggle', '#chatsToggle2']) {
        await expect(page.locator(action)).toBeVisible();
      }
      const header = page.locator((brand === 'coffee' ? '#menuView' : '#deliveryView') + ' .menu-head');
      await expect(header.locator('.menu-controls-row')).toBeVisible();
      await expect(header.locator('.mh-right')).toBeVisible();
      const rows = await header.locator('.mh-top').evaluate(top => {
        const titleHost = top.querySelector(':scope > div:first-child');
        const searchHost = top.querySelector(':scope > .mh-right');
        return [
          titleHost?.querySelector(':scope > .menu-controls-row') ? 'title-roles-edit' : 'unexpected',
          searchHost ? 'search-support' : 'unexpected',
        ];
      });
      expect(rows).toEqual(['title-roles-edit', 'search-support']);
    }
  }
});

test('staff menu header is exactly two rows for both brands and mobile widths', async ({ page }, testInfo) => {
  for (const brand of ['coffee', 'delivery']) {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: width === 320 ? 740 : 844 });
      await mockStaffSession(page);
      await page.goto('/?brand=' + brand);
      await page.waitForFunction(() =>
        window.me && window.me.role === 'admin' &&
        document.documentElement.hasAttribute('data-staff-ready') &&
        typeof window.syncBrandViews === 'function'
      );
      await page.evaluate(() => {
        document.documentElement.classList.add('is-ios-standalone');
        document.documentElement.style.setProperty('--sat', '47px');
        window.setMode('admin');
      });

      const view = brand === 'coffee' ? '#menuView' : '#deliveryView';
      const mode = page.locator('#modeSeg');
      const title = page.locator(view + ' .menu-controls-row > h1');
      const edit = page.locator('#editToggle');
      const searchRow = page.locator(view + ' .menu-head .mh-top > .mh-right');
      const search = searchRow.locator('.search');
      const supportHost = page.locator(view + ' #supportLauncherHost');
      const support = page.locator(view + ' #chatFab');
      await expect(mode).toBeVisible();
      await expect(title).toBeVisible();
      await expect(edit).toBeVisible();
      await expect(search).toBeVisible();
      await expect(supportHost).toBeVisible();
      await expect(support).toBeVisible();

      const layout = await page.evaluate((viewSelector) => {
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { x: box.x, right: box.right, y: box.y, bottom: box.bottom, width: box.width, height: box.height };
        };
        const viewRoot = document.querySelector(viewSelector);
        const head = viewRoot.querySelector('.menu-head');
        const top = head.querySelector('.mh-top');
        const rowOne = head.querySelector('.menu-controls-row');
        const titleElement = rowOne.querySelector('h1');
        const slot = rowOne.querySelector('.mode-seg-slot');
        const seg = slot.querySelector('#modeSeg');
        const editElement = rowOne.querySelector('#editToggle');
        const rowTwo = top.querySelector(':scope > .mh-right');
        const searchElement = rowTwo.querySelector('.search');
        const host = rowTwo.querySelector('#supportLauncherHost');
        const fab = host.querySelector('#chatFab');
        const rows = [
          { name: 'title', ...rect(titleElement) },
          { name: 'roles', ...rect(slot) },
          { name: 'edit', ...rect(editElement) },
          { name: 'search', ...rect(searchElement) },
          { name: 'support', ...rect(host) },
        ];
        return {
          menuHead: rect(head),
          top: rect(top),
          rowOne: rect(rowOne),
          rowTwo: rect(rowTwo),
          title: rect(titleElement),
          titleDescriptor: (() => {
            const descriptor = titleElement.querySelector('em');
            return descriptor ? {
              display:getComputedStyle(descriptor).display,
              ...rect(descriptor)
            } : null;
          })(),
          slot: rect(slot),
          edit: rect(editElement),
          search: rect(searchElement),
          support: rect(host),
          fab: rect(fab),
          modeButtons: Array.from(seg.querySelectorAll(':scope > button')).map(button => {
            const box = button.getBoundingClientRect();
            const face = getComputedStyle(button, '::before');
            const inset = {
              top: Number.parseFloat(face.top) || 0,
              right: Number.parseFloat(face.right) || 0,
              bottom: Number.parseFloat(face.bottom) || 0,
              left: Number.parseFloat(face.left) || 0
            };
            const hitEdges = [
              { edge:'top-left', x:box.left + 2, y:box.top + 2 },
              { edge:'top-right', x:box.right - 2, y:box.top + 2 },
              { edge:'bottom-right', x:box.right - 2, y:box.bottom - 2 },
              { edge:'bottom-left', x:box.left + 2, y:box.bottom - 2 },
              { edge:'top-center', x:box.left + box.width / 2, y:box.top + 2 },
              { edge:'right-center', x:box.right - 2, y:box.top + box.height / 2 },
              { edge:'bottom-center', x:box.left + box.width / 2, y:box.bottom - 2 },
              { edge:'left-center', x:box.left + 2, y:box.top + box.height / 2 }
            ].map(point => {
              const target = document.elementFromPoint(point.x, point.y);
              return {
                edge:point.edge,
                receives:!!target && (target === button || button.contains(target)),
                target:target?.id || target?.className?.baseVal || target?.className || target?.tagName || null
              };
            });
            return {
              text:button.textContent.trim(),
              ...rect(button),
              textFits:button.scrollWidth <= button.clientWidth + 1,
              fontSize:Number.parseFloat(getComputedStyle(button).fontSize),
              color:getComputedStyle(button).color,
              face:{
                width:box.width - inset.left - inset.right,
                height:box.height - inset.top - inset.bottom,
                inset,
                background:face.backgroundColor
              },
              hitEdges
            };
          }),
          editControl: (() => {
            const box = editElement.getBoundingClientRect();
            const face = getComputedStyle(editElement, '::after');
            const inset = {
              top:Number.parseFloat(face.top) || 0,
              right:Number.parseFloat(face.right) || 0,
              bottom:Number.parseFloat(face.bottom) || 0,
              left:Number.parseFloat(face.left) || 0
            };
            const hitEdges = [
              { edge:'top-left', x:box.left + 2, y:box.top + 2 },
              { edge:'top-right', x:box.right - 2, y:box.top + 2 },
              { edge:'bottom-right', x:box.right - 2, y:box.bottom - 2 },
              { edge:'bottom-left', x:box.left + 2, y:box.bottom - 2 },
              { edge:'top-center', x:box.left + box.width / 2, y:box.top + 2 },
              { edge:'right-center', x:box.right - 2, y:box.top + box.height / 2 },
              { edge:'bottom-center', x:box.left + box.width / 2, y:box.bottom - 2 },
              { edge:'left-center', x:box.left + 2, y:box.top + box.height / 2 }
            ].map(point => {
              const target = document.elementFromPoint(point.x, point.y);
              return {
                edge:point.edge,
                receives:!!target && (target === editElement || editElement.contains(target))
              };
            });
            return {
              ...rect(editElement),
              face:{
                width:box.width - inset.left - inset.right,
                height:box.height - inset.top - inset.bottom,
                inset,
                background:face.backgroundColor
              },
              hitEdges
            };
          })(),
          modeTrack: (() => {
            const box = seg.getBoundingClientRect();
            const face = getComputedStyle(seg, '::before');
            return {
              height:box.height - (Number.parseFloat(face.top) || 0) - (Number.parseFloat(face.bottom) || 0),
              background:face.backgroundColor
            };
          })(),
          controlOverlaps: (() => {
            const boxes = [...seg.querySelectorAll(':scope > button'), editElement].map(element => element.getBoundingClientRect());
            const overlaps = [];
            for (let i=0;i<boxes.length;i+=1) {
              for (let j=i+1;j<boxes.length;j+=1) {
                const width = Math.min(boxes[i].right,boxes[j].right)-Math.max(boxes[i].left,boxes[j].left);
                const height = Math.min(boxes[i].bottom,boxes[j].bottom)-Math.max(boxes[i].top,boxes[j].top);
                if (width > 0 && height > 0) overlaps.push({ a:i,b:j,width,height });
              }
            }
            return overlaps;
          })(),
          rowOrder: Array.from(rowOne.children).map(element =>
            element.id === 'editToggle' ? 'edit' :
              element.classList.contains('mode-seg-slot') ? 'roles' :
                element.classList.contains('menu-title-group') ? 'title-updated' :
                  element.tagName.toLowerCase()
          ),
          titleGroup: rect(rowOne.querySelector('.menu-title-group')),
          updated: rect(rowOne.querySelector('.menu-title-group .upd')),
          updatedHidden: getComputedStyle(rowOne.querySelector('.menu-title-group .upd')).display === 'none',
          headerChildren: [
            top.querySelector(':scope > div:first-child > .menu-controls-row') ? 'title-roles-edit' : 'unexpected',
            top.querySelector(':scope > .mh-right') ? 'search-support' : 'unexpected',
          ],
          extraRows: top.children.length - 2 +
            Array.from(top.querySelectorAll(':scope > div:first-child > :not(.menu-controls-row)'))
              .filter(element => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' &&
                  style.position !== 'absolute' && rect.width > 1 && rect.height > 1;
              }).length,
          adminBarVisible: (() => {
            const bar = document.getElementById('adminBar');
            const style = getComputedStyle(bar);
            const rect = bar.getBoundingClientRect();
            return !bar.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          })(),
          adminActionsVisible: ['promoToggle', 'dashToggle', 'chatsToggle2'].every(id => {
            const button = document.getElementById(id);
            if (!button || button.hidden) return false;
            const style = getComputedStyle(button);
            const rect = button.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
              rect.width > 0 && rect.height > 0;
          }),
          supportInsideRow: host.parentElement === rowTwo && fab.parentElement === host,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      }, view);

      expect(layout.rowOrder).toEqual(['title-updated', 'roles', 'edit']);
      expect(layout.updatedHidden).toBe(false);
      expect(layout.headerChildren).toEqual(['title-roles-edit', 'search-support']);
      expect(layout.extraRows).toBe(0);
      expect(layout.adminBarVisible).toBe(true);
      expect(layout.adminActionsVisible).toBe(true);
      expect(layout.supportInsideRow).toBe(true);
      expect(layout.modeButtons.map(button => button.text)).toEqual(['Гость', 'Кассир', 'Заказы', 'Админ']);

      const rowOneCenter = layout.rowOne.y + layout.rowOne.height / 2;
      for (const item of [layout.title, layout.slot, layout.edit]) {
        const itemCenter = item.y + item.height / 2;
        expect(Math.abs(itemCenter - rowOneCenter), JSON.stringify(layout)).toBeLessThanOrEqual(1);
      }
      expect(layout.title.width).toBeGreaterThanOrEqual(45);
      expect(layout.titleGroup.x).toBeLessThanOrEqual(layout.rowOne.x + 1);
      expect(layout.titleGroup.right).toBeLessThanOrEqual(layout.slot.x + 1);
      expect(layout.updated.x).toBeGreaterThanOrEqual(layout.title.right - 1);
      expect(layout.slot.right).toBeLessThanOrEqual(layout.rowOne.right + 1);
      expect(layout.edit.right).toBeLessThanOrEqual(layout.rowOne.right + 1);
      expect(layout.titleDescriptor?.display || 'none').toBe('none');
      expect(layout.slot.width).toBe(176);
      expect(layout.edit.x).toBeGreaterThanOrEqual(layout.slot.right);
      expect(layout.edit.right).toBeLessThanOrEqual(layout.rowOne.right + 1);
      expect(layout.rowTwo.y - layout.rowOne.bottom).toBe(8);
      expect(layout.search.y).toBeGreaterThanOrEqual(layout.rowTwo.y);
      expect(layout.support.y).toBeGreaterThanOrEqual(layout.rowTwo.y);
      expect(layout.support.width).toBe(44);
      expect(layout.support.height).toBe(44);
      expect(layout.fab.width).toBe(44);
      expect(layout.fab.height).toBe(44);
      expect(layout.modeButtons).toHaveLength(4);
      expect(layout.modeButtons.every(button =>
        button.width === 44 && button.height === 44 &&
        button.face.width === 32 && button.face.height === 32 &&
        button.face.inset.top === 6 && button.face.inset.right === 6 &&
        button.face.inset.bottom === 6 && button.face.inset.left === 6 &&
        button.textFits && button.hitEdges.every(point => point.receives)
      )).toBe(true);
      expect(layout.editControl.width).toBe(44);
      expect(layout.editControl.height).toBe(44);
      expect(layout.editControl.face.width).toBe(32);
      expect(layout.editControl.face.height).toBe(32);
      expect(layout.editControl.hitEdges.every(point => point.receives)).toBe(true);
      expect(layout.modeTrack.height).toBe(32);
      expect(layout.modeTrack.background).toBe(brand === 'coffee' ? 'rgb(18, 58, 107)' : 'rgb(58, 42, 28)');
      const activeMode = layout.modeButtons.find(button => button.text === 'Админ');
      expect(activeMode.face.background).toBe(brand === 'coffee' ? 'rgb(187, 215, 242)' : 'rgb(139, 43, 32)');
      expect(activeMode.color).toBe(brand === 'coffee' ? 'rgb(18, 58, 107)' : 'rgb(255, 255, 255)');
      expect(layout.editControl.face.background).toBe(brand === 'coffee' ? 'rgb(255, 255, 255)' : 'rgb(246, 238, 225)');
      expect(layout.controlOverlaps).toEqual([]);
      expect(layout.rowTwo.y - layout.edit.bottom).toBeGreaterThanOrEqual(4);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.menuHead.height).toBe(108);
      expect(layout.rowOne.height).toBe(44);
      expect(layout.rowTwo.height).toBe(44);
      expect(layout.top.height).toBe(96);
      const topGrid = await page.locator(view + ' .menu-head .mh-top').evaluate(element => {
        const style = getComputedStyle(element);
        return {
          display:style.display,
          rows:style.gridTemplateRows.split(' ').map(value => Number.parseFloat(value)),
          rowGap:Number.parseFloat(style.rowGap),
          height:Number.parseFloat(style.height)
        };
      });
      expect(topGrid.display).toBe('grid');
      expect(topGrid.rows).toEqual([44,44]);
      expect(topGrid.rowGap).toBe(8);
      expect(topGrid.height).toBe(96);

      const roleButtons = page.locator('#modeSeg > button');
      await roleButtons.nth(0).focus();
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const active = document.activeElement;
        const face = active && getComputedStyle(active, '::before');
        return {
          text:active?.textContent?.trim() || null,
          visible:!!active && active.matches(':focus-visible'),
          outlineStyle:face?.outlineStyle || 'none',
          outlineWidth:face?.outlineWidth || '0px'
        };
      });
      expect(focus.text).toBe('Кассир');
      expect(focus.visible).toBe(true);
      expect(focus.outlineStyle).toBe('solid');
      expect(Number.parseFloat(focus.outlineWidth)).toBe(2);
      await page.evaluate(() => document.activeElement?.blur?.());

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 4000 });
      await testInfo.attach(brand + '-staff-two-row-' + width + 'px', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });
    }
  }
});

test('desktop staff menu keeps title, role switcher and edit inside the menu header', async ({ page }, testInfo) => {
  const widths = [821, 1024, 1440];
  await mockStaffSession(page);
  for (const brand of ['coffee', 'delivery']) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/?brand=' + brand);
    await page.waitForFunction(() =>
      window.me && window.me.role === 'admin' &&
      document.documentElement.hasAttribute('data-staff-ready')
    );
    const view = brand === 'coffee' ? '#menuView' : '#deliveryView';
    await page.evaluate(() => window.setMode('admin'));
    const header = page.locator(view + ' .menu-head');
    const row = header.locator('.menu-controls-row');
    const seg = page.locator('#modeSeg');
    const edit = page.locator('#editToggle');
    const search = header.locator('.mh-right .search');
    await expect(row).toBeVisible();
    await expect(seg).toBeVisible();
    await expect(edit).toBeVisible();
    await expect(search).toBeVisible();

    const layout = await page.evaluate((viewSelector) => {
      const root = document.querySelector(viewSelector);
      const head = root.querySelector('.menu-head');
      const top = head.querySelector('.mh-top');
      const first = top.querySelector(':scope > div:first-child');
      const row = first.querySelector('.menu-controls-row');
      const titleGroup = row.querySelector('.menu-title-group');
      const title = titleGroup.querySelector(':scope > h1');
      const slot = row.querySelector(':scope > .mode-seg-slot');
      const seg = slot.querySelector('#modeSeg');
      const edit = row.querySelector('#editToggle');
      const titleGroup = row.querySelector('.menu-title-group');
      const updated = titleGroup?.querySelector('.upd');
      const searchRow = top.querySelector(':scope > .mh-right');
      const search = searchRow.querySelector('.search');
      const rect = node => {
        const box = node.getBoundingClientRect();
        return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom};
      };
      const style = node => {
        const s = getComputedStyle(node);
        return {display:s.display,color:s.color,background:s.backgroundColor,backgroundImage:s.backgroundImage,fontSize:s.fontSize};
      };
      return {
        head:rect(head),
        top:rect(top),
        title:rect(title),
        titleStyle:style(title),
        descriptor: title.querySelector('em') ? getComputedStyle(title.querySelector('em')).display : 'missing',
        row:rect(row),
        slot:rect(slot),
        seg:rect(seg),
        segStyle:style(seg),
        edit:rect(edit),
        titleGroup:rect(titleGroup),
        updated:rect(updated),
        updatedStyle:style(updated),
        updatedText:updated.textContent.trim(),
        editParent:edit.parentElement?.className || '',
        updatedParent:updated?.parentElement?.className || '',
        titleGroupParent:titleGroup?.parentElement?.className || '',
        segParent:seg.parentElement?.className || '',
        searchRow:rect(searchRow),
        search:rect(search),
        topDisplay:getComputedStyle(top).display,
        headerHasRoleClass:document.querySelector('header.topbar').classList.contains('has-menu-role-switcher'),
        topbarHasModeClass:document.querySelector('header.topbar').classList.contains('has-mode-switcher')
      };
    }, view);
    expect(layout.head.width).toBeGreaterThan(500);
    expect(layout.head.height).toBeLessThan(180);
    expect(layout.topDisplay).toBe('flex');
    expect(layout.segParent).toBe('mode-seg-slot');
    expect(layout.editParent).toBe('menu-controls-row');
    expect(layout.updatedParent).toBe('menu-title-group');
    expect(layout.titleGroupParent).toBe('menu-controls-row');
    expect(layout.updatedStyle.display).toBe('inline-flex');
    expect(layout.updatedText).toContain('Обновлено:');
    expect(layout.updated.y).toBeGreaterThanOrEqual(layout.row.y - 1);
    expect(layout.updated.y + layout.updated.height).toBeLessThanOrEqual(layout.row.bottom + 1);
    expect(layout.title.x).toBeLessThanOrEqual(layout.titleGroup.x + 1);
    expect(layout.updated.x).toBeGreaterThan(layout.title.right - 1);
    expect(layout.titleGroup.right).toBeLessThan(layout.seg.x);
    expect(layout.edit.x).toBeGreaterThan(layout.seg.right);
    expect(layout.headerHasRoleClass).toBe(true);
    expect(layout.topbarHasModeClass).toBe(false);
    expect(layout.title.width).toBeGreaterThan(100);
    expect(layout.slot.width).toBeGreaterThan(160);
    expect(layout.seg.width).toBeGreaterThan(160);
    expect(layout.title.y).toBeLessThan(layout.search.y);
    expect(layout.seg.y).toBeLessThan(layout.search.y);
    expect(layout.edit.y).toBeLessThan(layout.search.y);
    expect(layout.searchRow.y).toBeGreaterThanOrEqual(layout.row.bottom - 1);
    expect(layout.search.width).toBeGreaterThan(400);
    if (brand === 'delivery') {
      expect(layout.titleStyle.color).toBe('rgb(58, 42, 28)');
      expect(layout.titleStyle.fontSize).toBe('28px');
      expect(layout.descriptor).toBe('missing');
    } else {
      expect(layout.titleStyle.color).toBe('rgb(18, 58, 107)');
    }
    await testInfo.attach('desktop-staff-' + brand + '-menu-header-' + width + 'px', {
      body:await page.screenshot({fullPage:false}),
      contentType:'image/png'
    });
    }
    }
  }
});

test('desktop delivery role switcher stays in menu header with delivery colors in every menu mode', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:1440, height:1000 });
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready')
  );
  const seg = page.locator('#modeSeg');
  const head = page.locator('#deliveryView .menu-head');
  for (const mode of ['guest', 'admin']) {
    await page.evaluate(nextMode => window.setMode(nextMode), mode);
    await expect(seg).toBeVisible();
    const styles = await seg.evaluate(element => {
      const active = element.querySelector('button.on');
      const head = document.querySelector('#deliveryView .menu-head');
      const title = head.querySelector('h1');
      const rect = node => {
        const box = node.getBoundingClientRect();
        return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom};
      };
      return {
        parent:element.parentElement?.className || '',
        background:getComputedStyle(element).backgroundColor,
        activeBackground:active ? getComputedStyle(active).backgroundColor : null,
        activeColor:active ? getComputedStyle(active).color : null,
        titleColor:getComputedStyle(title).color,
        headBackgroundImage:getComputedStyle(head).backgroundImage,
        seg:rect(element),
        title:rect(title),
        search:rect(head.querySelector('.mh-right .search'))
      };
    });
    expect(styles.parent).toBe('mode-seg-slot');
    expect(styles.background).toBe('rgb(58, 42, 28)');
    expect(styles.titleColor).toBe('rgb(58, 42, 28)');
    expect(styles.headBackgroundImage).toContain('250, 245, 238');
    expect(styles.activeBackground).toBe('rgb(139, 43, 32)');
    expect(styles.activeColor).toBe('rgb(255, 255, 255)');
    expect(styles.seg.y).toBeLessThan(styles.search.y);
    await testInfo.attach('desktop-delivery-staff-' + mode + '-1440px', {
      body:await page.screenshot({fullPage:false}),
      contentType:'image/png'
    });
  }
});

test('desktop work modes return role switcher to topbar only while menu is hidden', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready')
  );
  const seg = page.locator('#modeSeg');
  for (const mode of ['cashier', 'orders']) {
    await page.evaluate(nextMode => window.setMode(nextMode), mode);
    await expect(seg).toBeVisible();
    await expect(page.locator(mode === 'cashier' ? '#cashierView' : '#ordersView')).toBeVisible();
    const state = await seg.evaluate(element => ({
      inTopbar:element.parentElement === document.querySelector('header.topbar'),
      topbarHasModeClass:document.querySelector('header.topbar').classList.contains('has-mode-switcher'),
      menuRoleClass:document.querySelector('header.topbar').classList.contains('has-menu-role-switcher'),
      editParent:document.getElementById('editToggle')?.parentElement?.id || '',
      menuVisible:getComputedStyle(document.querySelector('#deliveryView')).display !== 'none'
    }));
    expect(state.inTopbar).toBe(true);
    expect(state.topbarHasModeClass).toBe(true);
    expect(state.menuRoleClass).toBe(false);
    expect(state.editParent).toBe('adminBar');
    expect(state.menuVisible).toBe(false);
  }
});

async function readStandaloneHeaderLayout(page) {
  return page.locator('header.topbar').evaluate(header => {
    const visibleContent = Array.from(header.querySelectorAll('#venueToggle, #headerBrand, #topbar-actions'))
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          rect.width > 0 && rect.height > 0;
      });
    return {
      position: getComputedStyle(header).position,
      topOffset: getComputedStyle(header).top,
      paddingTop: Number.parseFloat(getComputedStyle(header).paddingTop),
      height: header.getBoundingClientRect().height,
      top: header.getBoundingClientRect().top,
      contentTop: Math.min(...visibleContent.map(element => element.getBoundingClientRect().top)),
      scrollY: window.scrollY,
      hasStaffRole: document.documentElement.hasAttribute('data-staff-role')
    };
  });
}

test('iOS standalone guest header stays pinned below the safe area on both brands', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === '/api/me'
      ? { customer: null }
      : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  for (const brand of ['coffee', 'delivery']) {
    await page.goto('/?brand=' + brand);
    await expect(page.locator('header.topbar')).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.classList.add('is-ios-standalone');
      document.documentElement.style.setProperty('--sat', '47px');
      document.body.style.minHeight = '1600px';
      window.scrollTo(0, 560);
    });

    const layout = await readStandaloneHeaderLayout(page);
    expect(layout.hasStaffRole).toBe(false);
    expect(layout.position).toBe('sticky');
    expect(layout.topOffset).toBe('0px');
    expect(layout.paddingTop).toBeGreaterThanOrEqual(47);
    expect(layout.height).toBeGreaterThanOrEqual(107);
    expect(layout.contentTop).toBeGreaterThanOrEqual(47);
    expect(layout.scrollY).toBeGreaterThan(0);
    expect(Math.abs(layout.top)).toBeLessThanOrEqual(1);
  }
});

test('iOS standalone staff header keeps the same safe-area geometry on both brands', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStaffSession(page);

  for (const brand of ['coffee', 'delivery']) {
    await page.goto('/?brand=' + brand);
    await page.waitForFunction(() =>
      window.me && window.me.role === 'admin' &&
      document.documentElement.hasAttribute('data-staff-ready')
    );
    await page.evaluate(() => window.setMode('admin'));
    await page.evaluate(() => {
      document.documentElement.classList.add('is-ios-standalone');
      document.documentElement.style.setProperty('--sat', '47px');
      document.body.style.minHeight = '1600px';
      window.scrollTo(0, 560);
    });

    const layout = await readStandaloneHeaderLayout(page);
    expect(layout.hasStaffRole).toBe(true);
    expect(layout.position).toBe('sticky');
    expect(layout.topOffset).toBe('0px');
    expect(layout.paddingTop).toBeGreaterThanOrEqual(47);
    expect(layout.height).toBeGreaterThanOrEqual(107);
    expect(layout.contentTop).toBeGreaterThanOrEqual(47);
    expect(layout.scrollY).toBeGreaterThan(0);
    expect(Math.abs(layout.top)).toBeLessThanOrEqual(1);
  }
});

test('work modes keep the role switcher in the topbar and preserve the support landmark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStaffSession(page);
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready') &&
    typeof window.syncBrandViews === 'function'
  );

  const mode = page.locator('#modeSeg');
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
  await expect(page.locator('#adminBar')).toBeVisible();

  await page.evaluate(() => window.setMode('orders'));
  await expect(page.locator('#ordersView')).toBeVisible();
  const ordersLayout = await mode.evaluate((seg) => ({
    inTopbar: seg.parentElement === document.querySelector('header.topbar'),
    topbarTop: document.querySelector('header.topbar').getBoundingClientRect().top,
    topbarHeight: document.querySelector('header.topbar').getBoundingClientRect().height,
    modeBottom: seg.getBoundingClientRect().bottom,
    headerBottom: document.querySelector('header.topbar').getBoundingClientRect().bottom,
    topbarPosition: getComputedStyle(document.querySelector('header.topbar')).position
  }));
  expect(ordersLayout.inTopbar).toBe(true);
  expect(ordersLayout.topbarTop).toBeLessThanOrEqual(1);
  expect(ordersLayout.topbarHeight).toBeLessThanOrEqual(64);
  expect(ordersLayout.modeBottom).toBeLessThanOrEqual(ordersLayout.headerBottom);
  expect(ordersLayout.topbarPosition).toBe('sticky');
  await expect(page.locator('#adminBar')).toBeVisible();
  await expect(page.locator('#chatsToggle2')).toBeHidden();
});
