import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test('coffee wordmark “и кофе” remains visible beside the logo without reaching the profile button', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.goto('/?brand=coffee');
  const wordmark = page.locator('#brandTitle');
  const profile = page.locator('#profileTopBtn');
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveAttribute('aria-label', '…и кофе');
  await expect(profile).toBeVisible();

  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => link.href.includes('/app/ui/theme/'));
    return links.length > 0 && links.every((link) => link.media !== 'print' && link.sheet !== null);
  });
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.evaluate(() => {
    const wordmark = document.getElementById('brandTitle');
    const profile = document.getElementById('profileTopBtn');
    const wordmarkRect = wordmark.getBoundingClientRect();
    const profileRect = profile.getBoundingClientRect();
    return {
      text: wordmark.getAttribute('aria-label'),
      clientWidth: wordmark.clientWidth,
      scrollWidth: wordmark.scrollWidth,
      wordmarkRight: wordmarkRect.right,
      profileLeft: profileRect.left,
    };
  });

  expect(metrics.text).toBe('…и кофе');
  expect(metrics.clientWidth).toBeGreaterThanOrEqual(84);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.wordmarkRight).toBeLessThan(metrics.profileLeft - 8);
});

test('coffee mobile visible wordmark is centered as one logo-and-text group', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const group=page.locator('header.topbar #headerBrand');
  await expect(group).toBeVisible();
  await expect(page.locator('#brandMark')).toBeVisible();
  await expect(page.locator('#brandTitle')).toBeVisible();
  const m=await page.evaluate(()=>{
    const mark=document.getElementById('brandMark').getBoundingClientRect();
    const title=document.getElementById('brandTitle').getBoundingClientRect();
    const profile=document.getElementById('profileTopBtn').getBoundingClientRect();
    return {left:mark.left,right:title.right,center:(mark.left+title.right)/2,viewportCenter:innerWidth/2,
      markRight:mark.right,titleLeft:title.left,titleRight:title.right,profileLeft:profile.left,
      groupWidth:document.getElementById('headerBrand').getBoundingClientRect().width};
  });
  expect(Math.abs(m.center-m.viewportCenter)).toBeLessThanOrEqual(2);
  expect(m.groupWidth).toBeLessThanOrEqual(196);
  expect(m.titleLeft).toBeGreaterThanOrEqual(m.markRight);
  expect(m.titleRight).toBeLessThan(m.profileLeft-8);
});
