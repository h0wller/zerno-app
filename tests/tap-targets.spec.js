import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const BRANDS = ['coffee', 'delivery'];
const ROLES = ['guest', 'cashier', 'dispatch', 'admin'];
const VIEWPORTS = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

async function prepareSession(page, role) {
  if (role !== 'guest') {
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === '/api/me'
        ? {
            customer: {
              id: 'tap-target-profile-' + role,
              name: 'Tap Target Test',
              phone: '+70000000001',
              role,
              verified: 1,
              qr: 'tap-target-profile-' + role,
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
  }

  await page.addInitScript((staffRole) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
    if (staffRole !== 'guest') {
      localStorage.setItem('zt_user', 'playwright-tap-target-profile-token');
      localStorage.setItem('zt_role', staffRole);
    }
  }, role);
}

for (const brand of BRANDS) {
  for (const role of ROLES) {
    for (const viewport of VIEWPORTS) {
      test(`${brand}/${role}: profile keeps a 32px face inside a 44px tap target at ${viewport.width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await prepareSession(page, role);
        await page.goto(`/?brand=${brand}`, { waitUntil: 'domcontentloaded' });

        if (role !== 'guest') {
          await page.waitForFunction((expectedRole) =>
            window.me && window.me.role === expectedRole &&
            document.documentElement.hasAttribute('data-staff-ready'),
          role);
        }

        const profile = page.locator('#profileTopBtn');
        await expect(profile).toBeVisible();

        const metrics = await profile.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const face = getComputedStyle(button, '::before');
          const inset = ['top', 'right', 'bottom', 'left'].reduce((result, side) => {
            result[side] = Number.parseFloat(face[side]) || 0;
            return result;
          }, {});
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          // The avatar is circular, so its effective 44px target is tested
          // on the circle's perimeter rather than at the square box corners.
          const targetRadius = 20;
          const points = Array.from({ length: 8 }, (_, index) => {
            const angle = index * Math.PI / 4;
            return [
              cx + Math.cos(angle) * targetRadius,
              cy + Math.sin(angle) * targetRadius,
            ];
          });
          return {
            width: rect.width,
            height: rect.height,
            pseudoContent: face.content,
            faceWidth: rect.width - inset.left - inset.right,
            faceHeight: rect.height - inset.top - inset.bottom,
            inset,
            hitPoints: points.map(([x, y]) => {
              const hit = document.elementFromPoint(x, y);
              return hit === button || button.contains(hit);
            }),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          };
        });

        expect(metrics.width, JSON.stringify(metrics)).toBe(44);
        expect(metrics.height, JSON.stringify(metrics)).toBe(44);
        expect(metrics.pseudoContent).not.toBe('none');
        expect(metrics.faceWidth, JSON.stringify(metrics)).toBe(32);
        expect(metrics.faceHeight, JSON.stringify(metrics)).toBe(32);
        expect(metrics.inset).toEqual({ top: 6, right: 6, bottom: 6, left: 6 });
        expect(metrics.hitPoints.every(Boolean), JSON.stringify(metrics)).toBe(true);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
        await profile.click({ trial: true });

        if (viewport.width === 390) {
          await testInfo.attach(`tap-target-profile-${brand}-${role}-390px`, {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png',
          });
        }
      });
    }
  }
}
