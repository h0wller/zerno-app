import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function captureMidAnimation(page, toast, animationName, progress, testInfo, attachmentName) {
  const sample = await toast.evaluate((element, options) => {
    const animation = element.getAnimations().find((item) =>
      item.animationName === options.animationName
    );
    if (!animation || !animation.effect) {
      throw new Error('Missing CSS animation: ' + options.animationName);
    }

    animation.pause();
    const duration = animation.effect.getComputedTiming().duration;
    animation.currentTime = duration * options.progress;

    const style = getComputedStyle(element);
    const transform = new DOMMatrixReadOnly(style.transform);

    return {
      animationName: animation.animationName,
      duration,
      opacity: Number.parseFloat(style.opacity),
      translateX: transform.m41,
      transform: style.transform,
    };
  }, { animationName, progress });

  expect(sample.animationName).toBe(animationName);
  expect(sample.duration).toBeGreaterThan(0);
  expect(sample.opacity).toBeGreaterThan(0);
  expect(sample.opacity).toBeLessThan(1);
  expect(sample.translateX).toBeGreaterThan(0);

  await testInfo.attach(attachmentName, {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });

  // Finish the paused animation so its normal lifecycle and toast timer can continue.
  await toast.evaluate((element, name) => {
    const animation = element.getAnimations().find((item) => item.animationName === name);
    if (animation && animation.playState === 'paused') animation.finish();
  }, animationName);

  return sample;
}

async function createToastWithHeldRemoval(page, message) {
  await page.evaluate((text) => {
    const element = window.toast(text, 'ℹ️');
    if (!element) throw new Error('window.toast did not create a toast');

    // Keep the real transient exit state attached long enough to capture it.
    // The production timer still calls remove(); this instance-level override
    // records that request, then the test releases the native removal below.
    element.__motionTestNativeRemove = element.remove.bind(element);
    element.remove = function () {
      element.dataset.motionTestRemoveRequested = 'true';
    };
  }, message);
}

async function releaseToastRemoval(toast) {
  await expect.poll(() => toast.getAttribute('data-motion-test-remove-requested'))
    .toBe('true');
  await toast.evaluate((element) => {
    element.__motionTestNativeRemove();
    delete element.__motionTestNativeRemove;
  });
  await expect(toast).toHaveCount(0);
}

async function prepareToastPage(page, brand, reducedMotion) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=' + brand);
  await page.waitForFunction(() => typeof window.toast === 'function');
}

test('toast uses short non-overshooting entry and exit motion in both brands', async ({ page }, testInfo) => {
  const toast = page.locator('#toasts .toast');

  for (const brand of ['coffee', 'delivery']) {
    await prepareToastPage(page, brand, 'no-preference');
    await createToastWithHeldRemoval(page, 'Motion feedback test');
    await expect(toast).toHaveCount(1);

    const entry = await toast.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationName: style.animationName,
        duration: style.animationDuration,
        easing: style.animationTimingFunction,
      };
    });
    expect(entry.animationName).toBe('tin');
    expect(entry.duration).toBe('0.18s');
    expect(entry.easing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    const entryFrame = await captureMidAnimation(
      page,
      toast,
      'tin',
      0.5,
      testInfo,
      'toast-normal-' + brand + '-entry-mid-390x844.png'
    );
    expect(entryFrame.duration).toBe(180);

    // .out is intentionally transient (300ms); sample faster than its lifetime.
    await expect.poll(() => toast.evaluate((element) => element.classList.contains('out')), {
      timeout: 3000,
      intervals: [50, 100],
    }).toBe(true);
    const exit = await toast.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationName: style.animationName,
        duration: style.animationDuration,
        easing: style.animationTimingFunction,
      };
    });
    expect(exit.animationName).toBe('tout');
    expect(exit.duration).toBe('0.12s');
    expect(exit.easing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    const exitFrame = await captureMidAnimation(
      page,
      toast,
      'tout',
      0.5,
      testInfo,
      'toast-normal-' + brand + '-exit-mid-390x844.png'
    );
    expect(exitFrame.duration).toBe(120);

    await releaseToastRemoval(toast);
  }
});

test('toast appears and disappears without animation under reduced motion', async ({ page }, testInfo) => {
  const toast = page.locator('#toasts .toast');

  for (const brand of ['coffee', 'delivery']) {
    await prepareToastPage(page, brand, 'reduce');
    await createToastWithHeldRemoval(page, 'Reduced motion feedback test');
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveCSS('animation-name', 'none');
    await expect(toast).toHaveCSS('animation-duration', '0s');
    await expect(toast).toHaveCSS('opacity', '1');
    await testInfo.attach('toast-reduced-' + brand + '-entry-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    // .out is intentionally transient (300ms); sample faster than its lifetime.
    await expect.poll(() => toast.evaluate((element) => element.classList.contains('out')), {
      timeout: 3000,
      intervals: [50, 100],
    }).toBe(true);
    await expect(toast).toHaveCSS('animation-name', 'none');
    await expect(toast).toHaveCSS('opacity', '0');
    await testInfo.attach('toast-reduced-' + brand + '-exit-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
    await releaseToastRemoval(toast);
  }
});
