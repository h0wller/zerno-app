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
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
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

    await page.evaluate(() => {
      window.scrollTo(0, 400);
      document.getElementById('profileTopBtn').focus();
      window.openPanel('profile');
    });
    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/open/);
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
        layoutShift: window.__layoutShifts.reduce((sum, value) => sum + value, 0),
      };
    });

    await page.evaluate(() => {
      const panel = document.getElementById('panel');
      const touch = (type, x) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', {
          value: type === 'touchend' ? [] : [{ clientX: x, clientY: 300 }],
        });
        panel.dispatchEvent(event);
      };
      touch('touchstart', 40);
      touch('touchmove', 230);
      touch('touchend', 230);
    });

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
        layoutShift: window.__layoutShifts.reduce((sum, value) => sum + value, 0),
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
