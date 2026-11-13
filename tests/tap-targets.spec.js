import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const BRANDS = ['coffee', 'delivery'];
const VIEWPORTS = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

for (const brand of BRANDS) {
  for (const viewport of VIEWPORTS) {
    test(`${brand}: profile control keeps a 32px face inside a 44px hit cell at ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('zt_onb', '1');
        sessionStorage.setItem('splashDone', '1');
      });
      await page.goto(`/?brand=${brand}`, { waitUntil: 'domcontentloaded' });

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
        // A circular target is 44px in diameter; test its four cardinal edges, not square corners outside the circle.
        const points = [
          [cx - 21, cy],
          [cx + 21, cy],
          [cx, cy - 21],
          [cx, cy + 21],
        ];
        const describe = (node) => {
          if (!node) return null;
          return {
            tag: node.tagName?.toLowerCase() || null,
            id: node.id || null,
            className: typeof node.className === 'string' ? node.className : null,
            pointerEvents: getComputedStyle(node).pointerEvents,
          };
        };
        const centerHit = document.elementFromPoint(cx, cy);
        return {
          rect: { x: rect.x, y: rect.y, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
          width: rect.width,
          height: rect.height,
          pseudoContent: face.content,
          faceWidth: rect.width - inset.left - inset.right,
          faceHeight: rect.height - inset.top - inset.bottom,
          inset,
          buttonPointerEvents: getComputedStyle(button).pointerEvents,
          centerHit: describe(centerHit),
          hitPoints: points.map(([x, y]) => ({
            x,
            y,
            receives: (() => {
              const hit = document.elementFromPoint(x, y);
              return hit === button || button.contains(hit);
            })(),
            stack: document.elementsFromPoint(x, y).slice(0, 4).map(describe),
          })),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });

      expect(metrics.width, JSON.stringify(metrics)).toBe(44);
      expect(metrics.height, JSON.stringify(metrics)).toBe(44);
      expect(metrics.pseudoContent).not.toBe('none');
      expect(metrics.faceWidth, JSON.stringify(metrics)).toBe(32);
      expect(metrics.faceHeight, JSON.stringify(metrics)).toBe(32);
      expect(metrics.hitPoints.every(point => point.receives), JSON.stringify(metrics)).toBe(true);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

      if (viewport.width === 390) {
        await testInfo.attach(`tap-target-profile-${brand}-390px`, {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png',
        });
      }
    });
  }
}


const deliveryFilterIngredients = [
  'Курица', 'Пепперони', 'Ветчина', 'Мясная',
  'Лосось', 'Тунец', 'Креветки', 'Овощная',
];

const deliveryFilterItems = deliveryFilterIngredients.map((ingredient, index) => ({
  id: 'tap-filter-' + index,
  cat: 'pizza',
  section: 'delivery',
  name: 'Пицца ' + ingredient,
  desc: '',
  comp: [ingredient],
  opts: [],
  price: 400 + index,
  e: '🍕',
  on: 1,
  img: '',
}));

for (const width of [320, 375, 390]) {
  test(`delivery subfilters keep their 40px visual pill inside a 44px hit target at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/api/dmenu*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: deliveryFilterItems }),
    }));

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

    const bar = page.locator('#deliveryView #deliverySubFilter');
    await expect(bar).toBeVisible();
    const chips = bar.locator('.subchip');
    await expect(chips).toHaveCount(deliveryFilterIngredients.length + 1);

    for (let index = 0; index < await chips.count(); index += 1) {
      const chip = chips.nth(index);
      await chip.evaluate((element) => element.scrollIntoView({
        block: 'nearest',
        inline: 'center',
        behavior: 'instant',
      }));

      const metrics = await chip.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const face = getComputedStyle(element, '::before');
        const rail = element.parentElement;
        const railRect = rail.getBoundingClientRect();
        const faceTop = Number.parseFloat(face.top) || 0;
        const faceBottom = Number.parseFloat(face.bottom) || 0;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const points = [
          [cx - 21, cy],
          [cx + 21, cy],
          [cx, cy - 21],
          [cx, cy + 21],
        ];
        return {
          width: rect.width,
          height: rect.height,
          radius: face.borderRadius,
          faceZIndex: face.zIndex,
          isolation: getComputedStyle(element).isolation,
          faceHeight: rect.height - faceTop - faceBottom,
          faceTop,
          faceBottom,
          targetWithinRail: rect.top >= railRect.top && rect.bottom <= railRect.bottom,
          railClientHeight: rail.clientHeight,
          railScrollHeight: rail.scrollHeight,
          railCuePointerEvents: getComputedStyle(rail, '::after').pointerEvents,
          hitPoints: points.map(([x, y]) => {
            const target = document.elementFromPoint(x, y);
            return target === element || element.contains(target);
          }),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });

      expect(metrics.height, JSON.stringify(metrics)).toBe(44);
      expect(metrics.width, JSON.stringify(metrics)).toBeGreaterThanOrEqual(58);
      expect(metrics.faceHeight, JSON.stringify(metrics)).toBe(40);
      expect(metrics.faceTop, JSON.stringify(metrics)).toBe(2);
      expect(metrics.faceBottom, JSON.stringify(metrics)).toBe(2);
      expect(metrics.radius).toBe('999px');
      expect(metrics.faceZIndex).toBe('-1');
      expect(metrics.isolation).toBe('isolate');
      expect(metrics.targetWithinRail, JSON.stringify(metrics)).toBe(true);
      expect(metrics.railCuePointerEvents).toBe('none');
      expect(metrics.railClientHeight).toBeGreaterThanOrEqual(44);
      expect(metrics.railScrollHeight).toBeLessThanOrEqual(metrics.railClientHeight);
      expect(metrics.hitPoints.every(Boolean), JSON.stringify(metrics)).toBe(true);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
      if (index === 0) {
        await chip.click({
          trial: true,
          scroll: 'none',
          position: { x: metrics.width / 2, y: metrics.height - 1 },
        });
      }
    }

    if (width === 390) {
      await testInfo.attach('tap-target-delivery-subfilters-390px', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png',
      });
    }
  });
}
