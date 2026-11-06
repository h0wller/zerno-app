import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('single staff action does not stretch the admin bar across the content column', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  const bar = page.locator('#adminBar');
  await bar.evaluate((element) => {
    element.hidden = false;
    Array.from(element.children).forEach((button, index) => { button.hidden = index > 0; });
  });
  await expect(bar).toBeVisible();
  const dimensions = await bar.evaluate((element) => ({
    parentWidth: element.getBoundingClientRect().width,
    buttonWidth: element.querySelector('button:not([hidden])').getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.parentWidth).toBeLessThanOrEqual(240);
  expect(dimensions.buttonWidth).toBeLessThanOrEqual(220);
  expect(dimensions.parentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('staff switcher mounts inside the menu card without growing the topbar', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb','1');
    localStorage.setItem('zt_inst_hide','1');
    sessionStorage.setItem('splashDone','1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.syncBrandViews === 'function');
  await page.evaluate(() => {
    window.me={role:'dispatch'};
    window.mode='orders';
    document.documentElement.setAttribute('data-staff-role','dispatch');
    window.syncBrandViews();
    window.renderModes();
  });
  const mode=page.locator('#modeSeg');
  await expect(mode).toBeVisible();
  const measure=()=>page.evaluate(()=>{
    const header=document.querySelector('header.topbar').getBoundingClientRect();
    const head=document.querySelector('#deliveryView .menu-head');
    const seg=document.getElementById('modeSeg'), edit=document.getElementById('editToggle');
    const sb=seg.getBoundingClientRect(), hb=head.getBoundingClientRect();
    return {
      headerHeight:header.height, modeHeight:sb.height, modeTop:sb.top, modeBottom:sb.bottom,
      headTop:hb.top, headBottom:hb.bottom, modeInMenu:seg.parentElement===head, editInMenu:edit.parentElement===head,
      buttonHeights:Array.from(seg.querySelectorAll('button'),b=>b.getBoundingClientRect().height),
      documentWidth:document.documentElement.scrollWidth, viewportWidth:document.documentElement.clientWidth
    };
  });
  const before=await measure();
  expect(before.headerHeight).toBeLessThanOrEqual(64);
  expect(before.modeInMenu).toBe(true);
  expect(before.editInMenu).toBe(true);
  expect(before.modeHeight).toBeGreaterThanOrEqual(44);
  expect(before.buttonHeights.length).toBeGreaterThanOrEqual(2);
  expect(before.buttonHeights.every(h=>h>=44&&h<=44.5)).toBe(true);
  expect(before.modeTop).toBeGreaterThanOrEqual(before.headTop);
  expect(before.modeBottom).toBeLessThanOrEqual(before.headBottom+1);
  expect(before.documentWidth).toBeLessThanOrEqual(before.viewportWidth+1);
  await page.evaluate(()=>{
    document.documentElement.setAttribute('data-staff-role','dispatch');
    document.documentElement.setAttribute('data-staff-ready','true');
    window.syncBrandViews();
  });
  const after=await measure();
  expect(after.headerHeight).toBe(before.headerHeight);
  expect(after.modeInMenu).toBe(true);
  expect(after.editInMenu).toBe(true);
});
