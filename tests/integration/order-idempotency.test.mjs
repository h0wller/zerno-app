import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

const port = await reservePort();
const base = 'http://127.0.0.1:' + port;
const dbPath = path.join(os.tmpdir(), 'zerno-order-idempotency-' + randomUUID() + '.db');
const root = path.resolve(import.meta.dirname, '../..');
let child;
let db;
let serverOutput = '';

async function request(route, options = {}) {
  const response = await fetch(base + '/api' + route, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: 'Bearer ' + options.token } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('Test server exited (' + child.exitCode + '):\\n' + serverOutput);
    }
    try {
      const health = await fetch(base + '/api/health');
      if (health.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for test server:\\n' + serverOutput);
}

async function register(name, phone) {
  return registerVerified(name, phone);
}

async function registerPending(name, phone) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: { name, phone, pin: '1234', consent: true },
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.customer?.verified, 0);
  return result.json.token;
}

async function seedOtp(key, code = '2468') {
  const response = await fetch(base + '/__test/otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, code, expiresInMs: 300000 }),
  });
  let json = {};
  try { json = await response.json(); } catch {}
  assert.equal(response.status, 200, JSON.stringify(json));
}

async function registerVerified(name, phone) {
  await seedOtp('reg:' + phone);
  const result = await request('/auth/register', {
    method: 'POST',
    body: { name, phone, pin: '1234', code: '2468', consent: true },
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.customer?.verified, 1);
  return result.json.token;
}

async function activateStaff(token, code) {
  const result = await request('/auth/activate', {
    method: 'POST',
    token,
    body: { code },
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  return result.json.customer;
}

function customerIdForToken(token) {
  return db.prepare("SELECT ref FROM tokens WHERE token=? AND kind='user'").get(token)?.ref;
}

function orderBody(clientOrderId, qty = 1, promo) {
  return {
    client_order_id: clientOrderId,
    method: 'delivery',
    place: 'Янтарный',
    addr: 'Советская 1',
    slot: 'asap',
    pay: 'cash',
    comment: 'Проверка идемпотентности',
    items: [{ id: 'idempotency-pizza', oi: 1, qty }],
    ...(promo ? { promo } : {}),
  };
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ZERNO_TEST_NOW: '2026-11-02T14:00:00.000Z',
      DB_PATH: dbPath,
      PORT: String(port),
      TELEGRAM_BOT_TOKEN: '',
      TG_WEBHOOK_SECRET: '',
      SMS_AUTH_ENABLED: 'true',
      ADMIN_CODE: 'integration-order-verification-admin-2026',
      CASHIER_CODE: 'integration-order-verification-cashier-2026',
      DISPATCH_CODE: 'integration-order-verification-dispatch-2026',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await waitForServer();

  db = new Database(dbPath);
  db.prepare(`INSERT INTO menu(
    id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,section,opts,sort_order
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'idempotency-pizza', 'pizza', '🍕', 'Тестовая пицца', '', '[]', '', '800/1000', '',
    0, 1, null, 'delivery',
    JSON.stringify([{ l: '30 см', p: 800, sz: 30 }, { l: '35 см', p: 1000, sz: 35 }]),
    1,
  );
  db.prepare("INSERT INTO meta(key,value) VALUES('order_no','40')").run();
  db.prepare(`INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    'idempotency-promo', 'RETRY10', 'percent', 10, 1, null, 1, 0,
    new Date().toISOString(), 'delivery',
  );
});

beforeEach(() => {
  db.exec(`
    DELETE FROM orders;
    DELETE FROM promo_use;
    DELETE FROM events;
    DROP TRIGGER IF EXISTS fail_order_insert;
    UPDATE promos SET uses=0;
    UPDATE meta SET value='40' WHERE key='order_no';
  `);
});

after(async () => {
  if (db) db.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      once(child, 'exit'),
      new Promise(resolve => setTimeout(resolve, 4000)),
    ]);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('delivery order totals use the published tariff for every supported settlement', async () => {
  const token = await register('Delivery Tariff Guest', '+7 900 200-00-11');
  const tariffs = [
    ['Янтарный', 200], ['Покровское', 200], ['Синявино', 200],
    ['Кленовое', 500], ['Охотное', 500], ['Русское', 500], ['Поваровка', 500],
    ['Морозовка', 500], ['Янтаровка', 500], ['Красноторовка', 500], ['Ягодное', 500],
    ['Донское', 1100], ['Прислово', 1100]
  ];

  const info = await request('/delivery/info');
  assert.equal(info.status, 200, JSON.stringify(info.json));
  for (let index = 0; index < tariffs.length; index++) {
    const [place, fee] = tariffs[index];
    const zone = info.json.zones.find(entry => entry.places.includes(place));
    assert.equal(zone && zone.fee, fee, place + ' delivery zone');
    const body = orderBody('tariff_' + String(index + 1).padStart(2, '0'), 1);
    body.place = place;
    const result = await request('/orders', { method: 'POST', token, body });
    assert.equal(result.status, 200, place + ': ' + JSON.stringify(result.json));
    assert.equal(result.json.order.total, 1000 + fee, place + ' persisted order total');
  }
});

test('same client_order_id replays one order and consumes a promo only once', async () => {
  const token = await register('Idempotency Guest', '+7 900 200-00-01');
  const body = orderBody('ord_retry_same_001', 1, 'RETRY10');

  const first = await request('/orders', { method: 'POST', token, body });
  const retryBody = {
    items: body.items,
    comment: body.comment,
    client_order_id: body.client_order_id,
    method: body.method,
    place: body.place,
    addr: body.addr,
    slot: body.slot,
    pay: body.pay,
    promo: body.promo,
  };
  const retry = await request('/orders', { method: 'POST', token, body: retryBody });

  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(retry.status, 200, JSON.stringify(retry.json));
  assert.equal(retry.json.order.id, first.json.order.id);
  assert.equal(retry.json.order.no, first.json.order.no);
  assert.equal(first.json.order.items[0].oi, 1, 'persist the selected option index for reorder');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '41');
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='RETRY10'").get().uses, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM promo_use WHERE promo='idempotency-promo'").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE a LIKE '%заказ #41%'").get().n, 1);
});

test('same key with a different payload returns a conflict and creates no second order', async () => {
  const token = await register('Payload Guest', '+7 900 200-00-02');
  const first = await request('/orders', {
    method: 'POST', token, body: orderBody('ord_payload_same_002', 1),
  });
  const changed = await request('/orders', {
    method: 'POST', token, body: orderBody('ord_payload_same_002', 2),
  });

  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(changed.status, 409, JSON.stringify(changed.json));
  assert.equal(changed.json.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(changed.json.order.id, first.json.order.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '41');
});

test('concurrent requests with the same key resolve to the same order', async () => {
  const token = await register('Concurrent Guest', '+7 900 200-00-03');
  const body = orderBody('ord_concurrent_same_003', 1);

  const results = await Promise.all([
    request('/orders', { method: 'POST', token, body }),
    request('/orders', { method: 'POST', token, body }),
  ]);

  assert.deepEqual(results.map(result => result.status), [200, 200]);
  assert.equal(results[0].json.order.id, results[1].json.order.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '41');
});

test('different keys and legacy requests without a key remain separate orders', async () => {
  const token = await register('Legacy Guest', '+7 900 200-00-04');
  const first = await request('/orders', {
    method: 'POST', token, body: orderBody('ord_distinct_004a', 1),
  });
  const second = await request('/orders', {
    method: 'POST', token, body: orderBody('ord_distinct_004b', 1),
  });
  const legacyBody = orderBody('ord_legacy_ignored', 1);
  delete legacyBody.client_order_id;
  const legacy = await request('/orders', { method: 'POST', token, body: legacyBody });

  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.notEqual(first.json.order.id, second.json.order.id);
  assert.equal(legacy.status, 200, JSON.stringify(legacy.json));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 3);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '43');
});

test('the same key can be used by different customers independently', async () => {
  const firstToken = await register('Scoped Guest One', '+7 900 200-00-07');
  const secondToken = await register('Scoped Guest Two', '+7 900 200-00-08');
  const body = orderBody('ord_customer_scope_007', 1);

  const first = await request('/orders', { method: 'POST', token: firstToken, body });
  const second = await request('/orders', { method: 'POST', token: secondToken, body });

  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.notEqual(first.json.order.id, second.json.order.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 2);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '42');
});

test('promo use and order number roll back when order insertion fails', async () => {
  const token = await register('Rollback Guest', '+7 900 200-00-06');
  const eventsBefore = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  db.exec(`
    CREATE TRIGGER fail_order_insert
    BEFORE INSERT ON orders
    BEGIN
      SELECT RAISE(ABORT, 'forced order insert failure');
    END;
  `);

  const result = await request('/orders', {
    method: 'POST',
    token,
    body: orderBody('ord_rollback_006', 1, 'RETRY10'),
  });

  assert.equal(result.status, 500);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='RETRY10'").get().uses, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM promo_use WHERE promo='idempotency-promo'").get().n, 0);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '40');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, eventsBefore);
});

test('malformed client_order_id is rejected before any order side effect', async () => {
  const token = await register('Invalid Key Guest', '+7 900 200-00-05');
  const result = await request('/orders', {
    method: 'POST', token, body: orderBody('contains spaces', 1),
  });

  assert.equal(result.status, 400);
  assert.equal(result.json.code, 'INVALID_CLIENT_ORDER_ID');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, '40');
});


test('pending guest cannot create an order before phone verification or staff activation', async () => {
  +const token = await registerPending('Pending Order Guest', '+7 900 200-01-01');
  const customerId = customerIdForToken(token);
  assert.equal(db.prepare('SELECT verified FROM customers WHERE id=?').get(customerId).verified, 0);

  const orderNumberBefore = db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value;
  const result = await request('/orders', {
    method: 'POST',
    token,
    body: orderBody('ord_pending_guest_001', 1),
  });

  assert.equal(result.status, 403, JSON.stringify(result.json));
  assert.equal(result.json.code, 'CUSTOMER_NOT_VERIFIED');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='order_no'").get().value, orderNumberBefore);
});

test('pending guest becomes verified only after a valid OTP login and can then order', async () => {
  const phone = '+7 900 200-01-08';
  +const registrationToken = await registerPending('OTP Login Guest', phone);
  const customerId = customerIdForToken(registrationToken);
  assert.equal(db.prepare('SELECT verified FROM customers WHERE id=?').get(customerId).verified, 0);

  await seedOtp(phone, '2468');
  const wrongCode = await request('/auth/login', {
    method: 'POST',
    body: { phone, otp: '9999' },
  });
  assert.equal(wrongCode.status, 403);
  assert.equal(db.prepare('SELECT verified FROM customers WHERE id=?').get(customerId).verified, 0);

  const verifiedLogin = await request('/auth/login', {
    method: 'POST',
    body: { phone, otp: '2468' },
  });
  assert.equal(verifiedLogin.status, 200, JSON.stringify(verifiedLogin.json));
  assert.equal(verifiedLogin.json.customer?.verified, 1);
  assert.equal(db.prepare('SELECT verified FROM customers WHERE id=?').get(customerId).verified, 1);

  const order = await request('/orders', {
    method: 'POST',
    token: verifiedLogin.json.token,
    body: orderBody('ord_otp_login_guest_008', 1),
  });
  assert.equal(order.status, 200, JSON.stringify(order.json));
});

test('OTP-verified guest can create an order', async () => {
  const token = await registerVerified('Verified Order Guest', '+7 900 200-01-02');
  const result = await request('/orders', {
    method: 'POST',
    token,
    body: orderBody('ord_verified_guest_002', 1),
  });

  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.order.cid, customerIdForToken(token));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
});

test('employee activation verifies a pending guest and unlocks order creation', async () => {
  const adminToken = await registerVerified('Order Verification Admin', '+7 900 200-01-03');
  await activateStaff(adminToken, 'integration-order-verification-admin-2026');

  +const guestToken = await registerPending('Activated Order Guest', '+7 900 200-01-04');
  const guestId = customerIdForToken(guestToken);
  assert.equal(db.prepare('SELECT verified FROM customers WHERE id=?').get(guestId).verified, 0);

  const activation = await request('/staff/activate-guest', {
    method: 'POST',
    token: adminToken,
    body: { id: guestId },
  });
  assert.equal(activation.status, 200, JSON.stringify(activation.json));
  assert.equal(db.prepare('SELECT verified FROM customers WHERE id=?').get(guestId).verified, 1);

  const order = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('ord_staff_activated_guest_004', 1),
  });
  assert.equal(order.status, 200, JSON.stringify(order.json));
  assert.equal(order.json.order.cid, guestId);
});

test('staff-created customer remains verified and can order after proving phone ownership', async () => {
  const adminToken = await registerVerified('Staff Customer Admin', '+7 900 200-01-05');
  await activateStaff(adminToken, 'integration-order-verification-admin-2026');

  const phone = '+7 900 200-01-06';
  const created = await request('/staff/customers', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Staff Created Order Guest', phone },
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.customer.verified, 1);

  await seedOtp(phone);
  const login = await request('/auth/login', {
    method: 'POST',
    body: { phone, otp: '2468' },
  });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  assert.equal(login.json.customer.verified, 1);

  const order = await request('/orders', {
    method: 'POST',
    token: login.json.token,
    body: orderBody('ord_staff_created_guest_006', 1),
  });
  assert.equal(order.status, 200, JSON.stringify(order.json));
});

test('staff role can place staff orders even when its own guest phone profile is unverified', async () => {
  +const token = await registerPending('Pending Staff Account', '+7 900 200-01-07');
  const staff = await activateStaff(token, 'integration-order-verification-cashier-2026');
  assert.equal(staff.role, 'cashier');
  assert.equal(staff.verified, 0);

  const result = await request('/orders', {
    method: 'POST',
    token,
    body: orderBody('ord_staff_unverified_007', 1),
  });

  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.order.by_staff, 1);
});
