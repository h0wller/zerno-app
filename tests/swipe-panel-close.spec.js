import { test, expect } from '@playwright/test';

test.describe('Mobile profile swipe close', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('swipe close uses the shared focus lifecycle and preserves page scroll', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      const user = { id: 'swipe_test', name: 'Тестер', phone: '+7 999 999-11-11', verified: 1 };
      localStorage.setItem('zt_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('zt_token', 'swipe_test_token');
      localStorage.setItem('token', 'swipe_test_token');
      window.__layoutShifts = [];
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value);
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        window.__layoutShiftObserver = observer;
        window.__collectLayoutShifts = () => {
          for (const entry of observer.takeRecords()) {
            if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value);
          }
          return window.__layoutShifts.reduce((sum, value) => sum + value, 0);
        };
      } catch (_) {
        window.__collectLayoutShifts = () => 0;
      }
    });

    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#profileTopBtn')).toBeVisible();
    await page.waitForFunction(() => typeof window.openPanel === 'function' && typeof window.closePanel === 'function');
    await page.waitForFunction(() => {
      const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter((link) => link.href.includes('/app/ui/theme/'));
      return stylesheets.length > 0 &&
        stylesheets.every((link) => link.media !== 'print' && link.sheet !== null);
    });
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )));

    const opening = await page.evaluate(() => {
      window.__syncOverlayCalls = 0;
      const rawSyncOverlay = window.syncOverlay;
      window.syncOverlay = function () {
        window.__syncOverlayCalls += 1;
        return rawSyncOverlay.apply(this, arguments);
      };
      window.__tgSyncCalls = 0;
      const rawTgSync = window.TgUx.sync;
      window.TgUx.sync = function () {
        window.__tgSyncCalls += 1;
        return rawTgSync.apply(this, arguments);
      };
      window.scrollTo(0, 400);
      const scrollBefore = window.scrollY;
      document.getElementById('profileTopBtn').focus({ preventScroll: true });
      window.openPanel('profile');
      return {
        scrollBefore,
        scrollAfter: window.scrollY,
        focusedId: document.activeElement && document.activeElement.className,
        syncOverlayCalls: window.__syncOverlayCalls,
        tgSyncCalls: window.__tgSyncCalls
      };
    });
    expect(opening.scrollAfter).toBe(opening.scrollBefore);
    expect(opening.syncOverlayCalls).toBe(1);
    expect(opening.tgSyncCalls).toBe(0);
    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/open/);
    const transitionProperty = await panel.evaluate(element => getComputedStyle(element).transitionProperty);
    expect(transitionProperty.split(',').map(value => value.trim())).toEqual(['transform']);
    // The panel slides in over 350ms; assert its final geometry, not the mid-transition frame.
    await expect.poll(() => panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.right - window.innerWidth);
    })).toBeLessThanOrEqual(1);
    const drawer = await panel.evaluate((element) => element.getBoundingClientRect().width);
    expect(drawer).toBeLessThanOrEqual(360);
    expect(drawer).toBeGreaterThan(300);
    await page.waitForTimeout(100);

    const before = await page.evaluate(() => {
      const header = document.querySelector('header.topbar');
      return {
        scrollY: window.scrollY,
        headerTop: header.getBoundingClientRect().top,
        headerPosition: getComputedStyle(header).position,
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        layoutShift: window.__collectLayoutShifts(),
      };
    });

    // Use Chromium's input pipeline: synthetic DOM Events are untrusted and do not
    // reproduce the hadRecentInput semantics of a real touch gesture.
    const gesture = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const startX = Math.ceil(rect.left + 10);
      return { startX, endX: Math.min(startX + 190, window.innerWidth - 10) };
    });
    expect(gesture.endX - gesture.startX).toBeGreaterThan(120);

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: gesture.startX, y: 300, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: gesture.endX, y: 300, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await client.detach();

    await expect(panel).not.toHaveClass(/open/, { timeout: 1500 });
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => {
      const header = document.querySelector('header.topbar');
      return {
        scrollY: window.scrollY,
        headerTop: header.getBoundingClientRect().top,
        headerPosition: getComputedStyle(header).position,
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        focusedId: document.activeElement && document.activeElement.id,
        layoutShift: window.__collectLayoutShifts(),
      };
    });

    expect(before.headerPosition).toBe('sticky');
    expect(before.bodyOverflowY).not.toBe('hidden');
    expect(before.headerTop).toBeLessThanOrEqual(1);
    expect(after.focusedId).toBe('profileTopBtn');
    expect(after.bodyOverflowY).not.toBe('hidden');
    expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.headerTop - before.headerTop)).toBeLessThanOrEqual(1);
    expect(after.layoutShift - before.layoutShift).toBeLessThan(0.001);
  });
});

for (const brand of ['coffee', 'delivery']) {
  for (const viewport of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'compact-landscape', width: 844, height: 390 },
    { name: 'tablet', width: 1024, height: 768 },
  ]) {
    test(`${brand}: profile drawer opens and closes immediately under reduced motion (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        localStorage.setItem('zt_onb', '1');
        sessionStorage.setItem('splashDone', '1');
      });

      await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        typeof window.openPanel === 'function' &&
        typeof window.closePanel === 'function'
      );
      await page.waitForFunction(() => {
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .filter(link => link.href.includes('/app/ui/theme/'));
        return stylesheets.length > 0 &&
          stylesheets.every(link => link.media !== 'print' && link.sheet !== null);
      });

      const panel = page.locator('#panel');
      await page.evaluate(() => window.openPanel('profile'));
      await expect(panel).toHaveClass(/open/);

      const opened = await panel.evaluate(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          transitionDuration: style.transitionDuration,
          transform: style.transform,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewportWidth: window.innerWidth
        };
      });
      expect(opened.transitionDuration.split(',').every(value => Number.parseFloat(value) === 0))
        .toBe(true);
      expect(opened.transform).toBe('none');
      expect(opened.left).toBeGreaterThanOrEqual(-1);
      expect(opened.right).toBeLessThanOrEqual(opened.viewportWidth + 1);
      expect(opened.width).toBeLessThanOrEqual(400 + 1);

      await page.evaluate(() => window.closePanel());
      await expect(panel).not.toHaveClass(/open/);
      await expect(page.locator('#overlay')).toHaveCSS('pointer-events', 'none');

      const closed = await panel.evaluate(element => ({
        transitionDuration: getComputedStyle(element).transitionDuration,
        transform: getComputedStyle(element).transform,
      }));
      expect(closed.transitionDuration.split(',').every(value => Number.parseFloat(value) === 0))
        .toBe(true);
      expect(closed.transform).not.toBe('none');
    });
  }
}


for (const viewport of [
  { name: 'mobile portrait', width: 390, height: 844 },
  { name: 'compact landscape', width: 844, height: 390 },
  { name: 'tablet drawer', width: 1024, height: 768 },
]) {
  test(`profile drawer uses transform-only motion at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.openPanel === 'function');
    await page.waitForFunction(() => {
      const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes('/app/ui/theme/'));
      return sheets.length > 0 && sheets.every(link => link.media !== 'print' && link.sheet !== null);
    });

    const panel = page.locator('#panel');
    await page.evaluate(() => window.openPanel('profile'));
    await expect(panel).toHaveClass(/open/);
    const motion = await panel.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        property: style.transitionProperty,
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction
      };
    });
    expect(motion.property.split(',').map(value => value.trim())).toEqual(['transform']);
    expect(motion.duration.split(',').every(value => Math.abs(parseFloat(value) - 0.35) < 0.001)).toBe(true);
    await expect.poll(() => panel.evaluate(element =>
      Math.abs(element.getBoundingClientRect().right - document.documentElement.clientWidth)
    )).toBeLessThanOrEqual(1);
  });
}
