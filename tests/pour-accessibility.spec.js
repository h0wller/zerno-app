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

  test('floating controls and confetti canvas have accessible landmark treatment', async ({ page }) => {
    await expect(page.locator('#fx')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#chatFab').locator('xpath=ancestor::aside[@aria-label="Поддержка"]')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Навигация по странице"] #scrollTopBtn')).toBeAttached();
  });

  test('ticker is static and header DOM order follows the visual sequence', async ({ page }) => {
    const ticker = await page.locator('#tickerTrack').evaluate((element) => ({
      animationName: getComputedStyle(element).animationName,
      itemCount: element.children.length,
    }));
    expect(ticker.animationName).toBe('none');
    expect(ticker.itemCount).toBeLessThanOrEqual(7);

    const order = await page.locator('header.topbar').evaluate((header) => {
      const childIndex = (selector) => Array.from(header.children).indexOf(header.querySelector(selector));
      return [
        childIndex('.venueWrap'),
        childIndex('#headerBrand'),
        childIndex('#mbonusBtn'),
        childIndex('#profileTopBtn'),
        childIndex('#modeSeg'),
      ];
    });
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
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
