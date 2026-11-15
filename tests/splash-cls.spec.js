import { test, expect } from '@playwright/test';

/* Сплэш не должен «прыгать» при поздней загрузке theme/*.css (они подключаются отложенно: media=print → all).
   Критичный CSS в index.html — точное зеркало theme/80-splash.css; этот тест ловит расхождение между ними. */
test.describe('Splash: стабильная геометрия первого кадра (CLS)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('геометрия сплэша не меняется после загрузки theme/*.css, CLS ≈ 0', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.__shifts = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) window.__shifts.push(e.value);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) { /* браузер без Layout Instability API */ }
    });

    // Имитируем медленную сеть: стили темы приходят с задержкой
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.continue();
    });

    const cssLoaded = page.waitForResponse((r) => r.url().includes('/theme/80-splash.css'));
    await page.goto('/', { waitUntil: 'commit' });

    const splash = page.locator('#brandSplashStatic');
    await expect(splash).toBeVisible();

    // offsetTop/Height/Width игнорируют transform-анимации входа и меряют именно раскладку
    const geometry = () => page.evaluate(() => {
      const st = document.getElementById('brandSplashStatic');
      return ['.spInner', '.spSub', '.spPizza', '.spCoffee', '.spPizza .em', '.spCoffee .em', '.spPizza img', '.spCoffee img']
        .map((sel) => {
          const el = st.querySelector(sel);
          let top = 0;
          for (let n = el; n && n !== st; n = n.offsetParent) top += n.offsetTop;
          return sel + ':' + top + ':' + el.offsetHeight + ':' + el.offsetWidth;
        });
    });

    const before = await geometry();           // первый кадр — только critical-css из <head>
    await cssLoaded;
    await page.waitForTimeout(1200);           // стили применены, анимации входа завершились
    const after = await geometry();            // итоговая раскладка — с 80-splash.css

    expect(after).toEqual(before);

    const cls = await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0));
    expect(cls).toBeLessThan(0.001);
  });
});
