import { test, expect } from '@playwright/test';

/* Сплэш не должен «прыгать» при поздней загрузке theme/*.css (они подключаются отложенно: media=print → all).
   Критичный CSS в index.html — зеркало theme/80-splash.css: проверяем геометрию и параметры входной анимации. */
test.describe('Splash: стабильная геометрия первого кадра (CLS)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('геометрия и motion сплэша не меняются после загрузки theme/*.css, CLS ≈ 0', async ({ page }, testInfo) => {
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
    const entryMotion = () => page.evaluate(() => {
      const st = document.getElementById('brandSplashStatic');
      return ['.spSub', '.spPizza', '.spCoffee', '.spPizza .em', '.spCoffee .em']
        .map((selector) => {
          const style = getComputedStyle(st.querySelector(selector));
          return {
            selector,
            name: style.animationName,
            duration: style.animationDuration,
            delay: style.animationDelay,
            timing: style.animationTimingFunction,
            fill: style.animationFillMode,
            iterations: style.animationIterationCount,
          };
        });
    });

    const before = await geometry();           // первый кадр — только critical-css из <head>
    const motionBefore = await entryMotion();
    await testInfo.attach('splash-critical-css-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await cssLoaded;
    await page.waitForFunction(() => {
      const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .find((item) => item.href.includes('80-splash.css'));
      return link && link.media === 'all' && Array.from(document.styleSheets)
        .some((sheet) => sheet.href === link.href);
    });
    await page.waitForTimeout(1200);           // стили применены, анимации входа завершились

    const after = await geometry();            // итоговая раскладка — с 80-splash.css
    const motionAfter = await entryMotion();
    expect(after).toEqual(before);
    expect(motionAfter).toEqual(motionBefore);

    await testInfo.attach('splash-theme-css-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const cls = await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0));
    expect(cls).toBeLessThan(0.001);
  });

  test('reduced-motion splash is static before and after deferred theme CSS', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.continue();
    });

    const cssLoaded = page.waitForResponse((response) => response.url().includes('/theme/80-splash.css'));
    await page.goto('/', { waitUntil: 'commit' });
    const splash = page.locator('#brandSplashStatic');
    await expect(splash).toBeVisible();

    const readAnimations = () => page.evaluate(() => {
      const root = document.getElementById('brandSplashStatic');
      return ['.spSub', '.spPizza', '.spCoffee', '.spPizza .em', '.spCoffee .em']
        .map((selector) => getComputedStyle(root.querySelector(selector)).animationName);
    });
    const before = await readAnimations();
    expect(before).toEqual(['none', 'none', 'none', 'none', 'none']);
    await testInfo.attach('splash-reduced-critical-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await cssLoaded;
    await page.waitForFunction(() => {
      const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .find((item) => item.href.includes('80-splash.css'));
      return link && link.media === 'all' && Array.from(document.styleSheets)
        .some((sheet) => sheet.href === link.href);
    });

    const after = await readAnimations();
    expect(after).toEqual(before);
    await testInfo.attach('splash-reduced-theme-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });
});
