#!/usr/bin/env node
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ADMIN = process.env.SMOKE_ADMIN_CODE || '';
const CASHIER = process.env.SMOKE_CASHIER_CODE || '';
let pass = 0, fail = 0;
const log = (ok, name, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };

async function call(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const has = (obj, p) => p.split('.').every(k => { if (obj == null || !(k in obj)) return false; obj = obj[k]; return true; });
function expect(name, r, status, fields = []) {
  const probs = [];
  if (r.status !== status) probs.push(`status ${r.status}≠${status}`);
  for (const f of fields) if (!has(r.json || {}, f)) probs.push(`нет поля "${f}"`);
  log(!probs.length, name, probs.join('; '));
}

(async () => {
  console.log(`Контракт-смоук → ${BASE}\n`);

  expect('GET /api/health', await call('GET', '/api/health'), 200, ['ok']);
  expect('GET /api/config', await call('GET', '/api/config'), 200, ['tgUsername']);
  expect('GET /api/menu', await call('GET', '/api/menu'), 200, ['items', 'updatedAt']);
  expect('GET /api/dmenu', await call('GET', '/api/dmenu'), 200, ['items']);
  expect('GET /api/delivery/info', await call('GET', '/api/delivery/info'), 200, ['hours', 'eta', 'zones', 'pickupAddr', 'pickupDiscount', 'weekPromo', 'pizzaMonth']);
  expect('GET /api/vapid', await call('GET', '/api/vapid'), 200, ['publicKey']);
  expect('GET /api/promo/info (нет кода)', await call('GET', '/api/promo/info?code=SMOKE_NOPE'), 200, ['ok']);
  expect('GET /api/chat/thread (пусто)', await call('GET', '/api/chat/thread?key=smoke-empty'), 200, ['msgs']);
  expect('POST /api/clientlog', await call('POST', '/api/clientlog', { body: { kind: 'smoke', msg: 'contract' } }), 200, ['ok']);
  expect('GET /api/definitely-not → 404', await call('GET', '/api/definitely-not'), 404);

  for (const p of ['/api/me', '/api/menu/all', '/api/orders', '/api/orders/mine', '/api/chat/list', '/api/promos', '/api/stats', '/api/staff/pending', '/api/staff/log', '/api/staff/customers', '/api/push/subs'])
    expect(`GET ${p} → 401`, await call('GET', p), 401, ['error']);
  expect('POST /api/orders (без токена) → 401', await call('POST', '/api/orders', { body: {} }), 401, ['error']);
  expect('POST /api/push/send (без токена) → 401', await call('POST', '/api/push/send', { body: { body: 'x' } }), 401, ['error']);

  const digits = '9' + String(Date.now()).slice(-9);
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Smoke ' + digits.slice(-4), phone: '+7' + digits, pin: '1234' } });
  expect('POST /api/auth/register', reg, 200, ['token', 'customer.id', 'customer.qr', 'customer.role']);
  const token = reg.json && reg.json.token;

  if (token) {
    expect('GET /api/me', await call('GET', '/api/me', { token }), 200, ['customer.id', 'customer.name', 'customer.phone', 'customer.stamps', 'customer.free', 'customer.cups', 'customer.qr', 'customer.role', 'customer.verified', 'customer.welcome', 'customer.tg', 'customer.notify_tg', 'customer.notify_web', 'customer.history']);
    expect('PUT /api/me', await call('PUT', '/api/me', { token, body: { name: 'Smoke renamed' } }), 200, ['customer.name']);
    expect('PUT /api/me/notify', await call('PUT', '/api/me/notify', { token, body: { tg: 0, web: 1 } }), 200, ['customer.notify_tg']);
    await call('PUT', '/api/me/notify', { token, body: { tg: 1, web: 1 } });
    expect('GET /api/orders/mine', await call('GET', '/api/orders/mine', { token }), 200, ['orders']);
    expect('POST /api/orders (пустая корзина) → 400', await call('POST', '/api/orders', { token, body: { method: 'pickup', items: [] } }), 400, ['error']);
    expect('POST /api/redeem (нет подарков) → 400', await call('POST', '/api/redeem', { token }), 400, ['error']);
    expect('POST /api/push/subscribe (bad sub) → 400', await call('POST', '/api/push/subscribe', { token, body: { sub: {} } }), 400, ['error']);
    expect('POST /api/push/test', await call('POST', '/api/push/test', { token }), 200, ['ok']);
    expect('POST /api/push/unsubscribe', await call('POST', '/api/push/unsubscribe', { token }), 200, ['ok']);
    expect('POST /api/auth/login (неверный PIN) → 403', await call('POST', '/api/auth/login', { body: { phone: '+7' + digits, pin: '0000' } }), 403, ['error']);
    expect('POST /api/auth/request-otp (нет TG) → 400', await call('POST', '/api/auth/request-otp', { body: { phone: '+7' + digits } }), 400, ['error']);
    expect('POST /api/auth/activate-guest (неверный код) → 403', await call('POST', '/api/auth/activate-guest', { token, body: { code: '0000' } }), 403, ['error']);
    expect('POST /api/chat/send', await call('POST', '/api/chat/send', { body: { key: 'smoke-' + digits, text: 'contract smoke', ctx: 'coffee' } }), 200, ['ok']);
    expect('GET /api/chat/thread (после send)', await call('GET', '/api/chat/thread?key=smoke-' + digits), 200, ['msgs']);
    expect('GET /api/staff/pending (гость) → 403', await call('GET', '/api/staff/pending', { token }), 403, ['error']);
    expect('GET /api/chat/list (гость) → 403', await call('GET', '/api/chat/list', { token }), 403, ['error']);
    expect('GET /api/orders (гость) → 403', await call('GET', '/api/orders', { token }), 403, ['error']);
  }

  if (token && CASHIER) {
    expect('POST /api/auth/activate (кассир)', await call('POST', '/api/auth/activate', { token, body: { code: CASHIER } }), 200, ['customer.role']);
    expect('GET /api/staff/pending (кассир)', await call('GET', '/api/staff/pending', { token }), 200, ['pending']);
    expect('GET /api/staff/log', await call('GET', '/api/staff/log', { token }), 200, ['log']);
    expect('GET /api/staff/customers?search', await call('GET', '/api/staff/customers?search=' + digits, { token }), 200, ['customers']);
    expect('GET /api/orders (кассир)', await call('GET', '/api/orders', { token }), 200, ['orders']);
  }
  if (token && ADMIN) {
    expect('POST /api/auth/activate (админ)', await call('POST', '/api/auth/activate', { token, body: { code: ADMIN } }), 200, ['customer.role']);
    expect('GET /api/menu/all', await call('GET', '/api/menu/all', { token }), 200, ['items', 'updatedAt']);
    expect('GET /api/promos', await call('GET', '/api/promos', { token }), 200, ['promos']);
    expect('GET /api/stats', await call('GET', '/api/stats', { token }), 200, ['total', 'newWeek', 'newMonth', 'stampsToday', 'stampsWeek', 'stampsMonth', 'redeemed', 'returning', 'avgCups', 'promoUses', 'days']);
    expect('GET /api/push/subs', await call('GET', '/api/push/subs', { token }), 200, ['subs', 'tg']);
  }

  if (token) expect('POST /api/exit', await call('POST', '/api/exit', { token }), 200, ['ok']);

  console.log(`\nИтог: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Смоук упал:', e.message); process.exit(1); });