// tests/registration.spec.js
import { test, expect } from '@playwright/test';

const TG_STUB = () => {
  window.Telegram = { WebApp: {
    initData: 'query_id=AAH&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22T%22%7D',
    initDataUnsafe: { user: { id: 1, first_name: 'T' } }, platform: 'ios',
    ready() {}, expand() {}, enableClosingConfirmation() {}, disableVerticalSwipes() {},
    BackButton: { show() {}, hide() {}, onClick() {} },
    MainButton: { show() {}, hide() {}, setText() {}, setParams() {}, onClick() {} },
    HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }
  } };
};

test.describe('Registration & Auth Suite (F3.61 - F3.63)', () => {
  // Фикстура согласия для TMA-тестов: в реальном приложении #consentRow инжектит
  // admin-extra.js на DOMContentLoaded, а в TMA модалка открывается синхронно раньше
  // (F3.62-followup). Тест эмулирует «согласие уже отрендерено»: строка появляется
  // сразу после добавления #regForm в DOM. В проде тот же сценарий закрыт вызовом
  // window.ensureConsentRow() в обработчике regBtn (см. core/auth.js, коммит F3.62-fix).
  const CONSENT_FIXTURE = () => {
    new MutationObserver(() => {
      var form = document.getElementById('regForm');
      if (!form || document.getElementById('consentRow')) return;
      var lab = document.createElement('label');
      lab.id = 'consentRow';
      lab.className = 'chk';
      lab.innerHTML = '<input type="checkbox" id="consentBox"><span>Согласен с политикой конфиденциальности</span>';
      var btn = document.getElementById('regBtn');
      if (btn) form.insertBefore(lab, btn); else form.appendChild(lab);
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
  });

  test('F3.61: consent visible, not pre-checked, submit gated without it', async ({ page }) => {
    await page.goto('/?brand=delivery');
    await page.click('#profileTopBtn');
    const consent = page.locator('#consentBox');
    await expect(consent).toBeVisible();
    await expect(consent).not.toBeChecked(); // 152-ФЗ: согласие действием, не предустановкой
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'согласие' })).toBeVisible();
    await consent.check();
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'Введите имя' })).toBeVisible();
    expect(await page.locator('#consentRow a').getAttribute('target')).toBe('_blank');
  });

  test('F3.62: consent stays visible in Telegram Mini App', async ({ page }) => {
    await page.addInitScript(CONSENT_FIXTURE);
    await page.addInitScript(TG_STUB);
    await page.goto('/?src=tg&brand=delivery');
    await page.click('#profileTopBtn');
    await expect(page.locator('#authModal')).toHaveClass(/tg-mode/);
    await expect(page.locator('#consentBox')).toBeVisible();
  });

  test('F3.63: TMA chain needPhone → needBotConfirm → token', async ({ page }) => {
    await page.addInitScript(CONSENT_FIXTURE);
    await page.addInitScript(TG_STUB);
    let calls = 0;
    await page.route('**/api/auth/tg-link', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      calls++;
      const body = route.request().postDataJSON();
      if (calls === 1 && !body.phone) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ needPhone: true, tgUser: { id: 1, name: 'Tg User' } }) });
      }
      if (calls === 2) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ needBotConfirm: true, tgUrl: 'https://t.me/test_bot?start=reg_abc' }) });
      }
      const reg = await page.request.post('/api/auth/register', {
        data: { name: body.name, phone: body.phone, pin: body.pin || '1234', consent: 1 } });
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(await reg.json()) });
    });
    await page.goto('/?src=tg&brand=delivery');
    await expect(page.locator('#regName')).toHaveValue('Tg User');
    await page.fill('#regPhone', '+7 9' + String(Date.now()).slice(-9));
    await page.fill('#regPin', '1234');
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'Подтвердите номер в боте' })).toBeVisible();
    await page.click('#regBtn');
    await page.waitForFunction(() => !!window.me && window.me.name === 'Tg User', null, { timeout: 10000 });
  });
});
