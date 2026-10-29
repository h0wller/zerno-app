import { test, expect } from '@playwright/test';

const authHeaders = token => ({ Authorization: 'Bearer ' + token });

function uniquePhone() {
  const digits = '9' + String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 10));
  return '+7 ' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + '-' +
    digits.slice(6, 8) + '-' + digits.slice(8, 10);
}

async function registerVerifiedGuest(request, src) {
  const phone = uniquePhone();
  const code = '4826';
  const otp = await request.post('/api/auth/__test/otp', {
    data: { key: 'reg:' + phone, code, expiresInMs: 120000 },
  });
  expect(otp.ok(), 'test OTP fixture must be available only in isolated test mode').toBeTruthy();

  const response = await request.post('/api/auth/register', {
    data: {
      name: 'E2E Bonus Guest',
      phone,
      pin: '1357',
      code,
      consent: 1,
      ...(src ? { src } : {}),
    },
  });
  const responseText = await response.text();
  expect(response.status(), responseText).toBe(200);
  const payload = JSON.parse(responseText);
  expect(payload.token).toBeTruthy();
  expect(payload.customer.verified).toBe(1);
  expect(payload.customer.free).toBe(1);
  expect(payload.customer.stamps).toBe(0);
  expect(payload.customer.history.some(row => /Бонус «(Регистрация|Регистрация по QR)»/.test(row.a))).toBeTruthy();
  return { phone, token: payload.token, customer: payload.customer };
}

async function assertFreeDeliveryIsSingleUse(request, token) {
  const headers = authHeaders(token);
  const free = await request.get('/api/me/free-delivery', { headers });
  expect(free.ok()).toBeTruthy();
  const { code } = await free.json();
  expect(code).toMatch(/^B[0-9A-F]{8}$/);

  const menuResponse = await request.get('/api/dmenu');
  expect(menuResponse.ok()).toBeTruthy();
  const menu = await menuResponse.json();
  const item = menu.items.find(row => row.on !== 0 && row.section === 'delivery') || menu.items[0];
  expect(item, 'test database must contain at least one enabled delivery item').toBeTruthy();

  const order = {
    method: 'delivery',
    place: 'Янтарный',
    addr: 'Тестовая, 1',
    slot: 'asap',
    pay: 'cash',
    items: [{ id: item.id, qty: 1, oi: Array.isArray(item.opts) && item.opts.length ? 0 : -1 }],
    promo: code,
  };
  const first = await request.post('/api/orders', { headers, data: order });
  const firstText = await first.text();
  expect(first.status(), firstText).toBe(200);
  const firstPayload = JSON.parse(firstText);
  expect(firstPayload.order.fee).toBe(0);
  expect(firstPayload.order.promo).toBe(code);

  const afterUse = await request.get('/api/me/free-delivery', { headers });
  expect(afterUse.ok()).toBeTruthy();
  expect((await afterUse.json()).code).toBeNull();

  const second = await request.post('/api/orders', { headers, data: order });
  expect(second.status()).toBe(410);
}

test.describe('Bonus Lifecycle Suite', () => {
  test('verified signup receives one welcome bonus and one free delivery', async ({ request }) => {
    const { phone, token } = await registerVerifiedGuest(request);
    const duplicate = await request.post('/api/auth/register', {
      data: { name: 'E2E Bonus Guest', phone, pin: '1357', code: '4826', consent: 1 },
    });
    expect(duplicate.status()).toBe(409);

    const me = await request.get('/api/me', { headers: authHeaders(token) });
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).customer.free).toBe(1);
    await assertFreeDeliveryIsSingleUse(request, token);
  });

  test('QR signup grants the same one-time welcome bonus and single-use delivery', async ({ request }) => {
    const { token, customer } = await registerVerifiedGuest(request, 'qr');
    expect(customer.history.some(row => /Бонус «Регистрация по QR»/.test(row.a))).toBeTruthy();
    await assertFreeDeliveryIsSingleUse(request, token);
  });
});
