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
    const ticker = await page.locator('.ticker').evaluate((container) => {
      const track = container.querySelector('#tickerTrack');
      const containerStyle = getComputedStyle(container);
      const trackStyle = getComputedStyle(track);
      return {
        animationName: trackStyle.animationName,
        flexWrap: trackStyle.flexWrap,
        whiteSpace: trackStyle.whiteSpace,
        overflowX: containerStyle.overflowX,
        height: container.getBoundingClientRect().height,
        itemCount: track.children.length,
      };
    });
    expect(ticker.animationName).toBe('none');
    expect(ticker.flexWrap).toBe('nowrap');
    expect(ticker.whiteSpace).toBe('nowrap');
    expect(ticker.overflowX).toBe('auto');
    expect(ticker.height).toBe(28);
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
