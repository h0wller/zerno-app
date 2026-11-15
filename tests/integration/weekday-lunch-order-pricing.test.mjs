import { test, before, after } from 'node:test';
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
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const port = await reservePort();
const base = 'http://127.0.0.1:' + port;
const dbPath = path.join(os.tmpdir(), 'zerno-lunch-' + randomUUID() + '.db');
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
      throw new Error('Test server exited (' + child.exitCode + '):\n' + serverOutput);
    }
    try {
      const health = await fetch(base + '/api/health');
      if (health.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for test server:\n' + serverOutput);
}

async function register(name, phone) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: { name, phone, pin: '1234', consent: 1 },
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.ok(result.json.token);
  return { token: result.json.token, customerId: result.json.customer.id };
}

function orderBody(slot, method = 'delivery', promo) {
  return {
    method,
    place: method === 'pickup' ? '' : 'Янтарный',
    addr: method === 'pickup' ? '' : 'Советская 1',
    slot,
    pay: 'cash',
    items: [{ id: 'lunch-pizza', oi: 1, qty: 2 }],
    ...(promo ? { promo } : {}),
  };
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ZERNO_TEST_NOW: '2026-11-02T08:00:00.000Z',
      DB_PATH: dbPath,
      PORT: String(port),
      ADMIN_CODE: 'ci-admin-role-code-2026',
      CASHIER_CODE: 'ci-cashier-role-code-2026',
      DISPATCH_CODE: 'ci-dispatch-role-code-2026',
      TELEGRAM_BOT_TOKEN: '',
      TG_WEBHOOK_SECRET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  await waitForServer();

  db = new Database(dbPath);
  db.prepare(`INSERT INTO menu(
    id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,section,opts,sort_order
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'lunch-pizza', 'pizza', '🍕', 'Тестовая пицца', '', '[]', '', '800/1000', '',
    0, 1, null, 'delivery',
    JSON.stringify([{ l: '30 см', p: 800, sz: 30 }, { l: '35 см', p: 1000, sz: 35 }]),
    1,
  );
  db.prepare("INSERT INTO meta(key,value) VALUES('week_promo',?)")
    .run(JSON.stringify({
      text: 'Тестовая неделя',
      threshold: 1000,
      gift: 'Подарок недели',
      until: '2099-11-03T23:59:00.000Z',
    }));
  db.prepare("INSERT INTO meta(key,value) VALUES('pizza_month',?)")
    .run(JSON.stringify({ on: true, name: 'Пицца месяца' }));
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    'lunch-percent', 'LUNCH10', 'percent', 10, 1, null, 0, 0, now, 'delivery',
  );
  db.prepare(`INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    'lunch-free-ship', 'FREEFIRST', 'freeship', 1, 1, null, 0, 0, now, 'delivery',
  );
  db.prepare(`INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    'lunch-fixed', 'LUNCHFIXED', 'fixed', 250, 1, null, 0, 0, now, 'delivery',
  );
});

after(async () => {
  if (db) db.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('lunch pricing stacks only the staff discount and blocks all other promotions', async () => {
  const { token: guestToken, customerId: guestId } = await register('Lunch Guest', '+7 900 100-00-11');
  const { token: staffToken } = await register('Lunch Staff', '+7 900 100-00-12');
  const registrationFreeCode = 'SIGNUPFREE1';
  db.prepare(`INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope,owner)
    VALUES(?,?,?,?,1,NULL,1,0,?,'delivery',?)`).run(
    'signup-free-ship', registrationFreeCode, 'freeship', 0, new Date().toISOString(), guestId,
  );
  const activate = await request('/auth/activate', {
    method: 'POST',
    token: staffToken,
    body: { code: 'ci-cashier-role-code-2026' },
  });
  assert.equal(activate.status, 200, JSON.stringify(activate.json));

  const percentBlocked = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 12:00–12:30', 'delivery', 'LUNCH10'),
  });
  assert.equal(percentBlocked.status, 400);
  assert.match(percentBlocked.json.error || '', /обеденной акции/i);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='LUNCH10'").get().uses, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM promo_use WHERE promo='lunch-percent'").get().n, 0);

  const freeShipBlocked = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 12:30–13:00', 'delivery', 'FREEFIRST'),
  });
  assert.equal(freeShipBlocked.status, 400);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='FREEFIRST'").get().uses, 0);

  const registrationFreeDelivery = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 12:30–13:00', 'delivery', registrationFreeCode),
  });
  assert.equal(registrationFreeDelivery.status, 200, JSON.stringify(registrationFreeDelivery.json));
  assert.equal(registrationFreeDelivery.json.order.discount, 400);
  assert.equal(registrationFreeDelivery.json.order.fee, 0);
  assert.equal(registrationFreeDelivery.json.order.promodiscount, 0);
  assert.equal(registrationFreeDelivery.json.order.promo, registrationFreeCode);
  assert.equal(registrationFreeDelivery.json.order.total, 1600);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code=?").get(registrationFreeCode).uses, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM promo_use WHERE promo='signup-free-ship'").get().n, 1);
  const freeDeliveryAfterUse = await request('/me/free-delivery', { token: guestToken });
  assert.equal(freeDeliveryAfterUse.status, 200);
  assert.equal(freeDeliveryAfterUse.json.code, null);

  const fixedBlocked = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 12:30–13:00', 'delivery', 'LUNCHFIXED'),
  });
  assert.equal(fixedBlocked.status, 400);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='LUNCHFIXED'").get().uses, 0);

  const guestLunch = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 12:00–12:30'),
  });
  assert.equal(guestLunch.status, 200, JSON.stringify(guestLunch.json));
  assert.equal(guestLunch.json.order.discount, 400);
  assert.equal(guestLunch.json.order.discount_label, '20% обеденная акция');
  assert.deepEqual(guestLunch.json.order.gifts, [
    { name: 'Подарок недели', qty: 2 },
    { name: 'Пицца месяца — подарок', qty: 1 },
  ]);
  assert.equal(guestLunch.json.order.total, 1800);

  const staffLunch = await request('/orders', {
    method: 'POST',
    token: staffToken,
    body: orderBody('02.11 | 12:30–13:00'),
  });
  assert.equal(staffLunch.status, 200, JSON.stringify(staffLunch.json));
  assert.equal(staffLunch.json.order.by_staff, 1);
  assert.equal(staffLunch.json.order.discount, 600);
  assert.equal(staffLunch.json.order.discount_label, '20% обеденная акция + 10% для своих');
  assert.deepEqual(staffLunch.json.order.gifts, [
    { name: 'Подарок недели', qty: 2 },
    { name: 'Пицца месяца — подарок', qty: 1 },
  ]);
  assert.equal(staffLunch.json.order.total, 1600);

  const pickupLunch = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 13:00–13:30', 'pickup'),
  });
  assert.equal(pickupLunch.status, 200, JSON.stringify(pickupLunch.json));
  assert.equal(pickupLunch.json.order.discount, 400);
  assert.equal(pickupLunch.json.order.discount_label, '20% обеденная акция');

  const afterLunch = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 16:00–16:30', 'delivery', 'LUNCH10'),
  });
  assert.equal(afterLunch.status, 200, JSON.stringify(afterLunch.json));
  assert.equal(afterLunch.json.order.discount, 0);
  assert.equal(afterLunch.json.order.promodiscount, 200);
  assert.equal(afterLunch.json.order.gifts.length, 2);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='LUNCH10'").get().uses, 1);

  const afterLunchFixed = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: orderBody('02.11 | 16:30–17:00', 'delivery', 'LUNCHFIXED'),
  });
  assert.equal(afterLunchFixed.status, 200, JSON.stringify(afterLunchFixed.json));
  assert.equal(afterLunchFixed.json.order.discount, 0);
  assert.equal(afterLunchFixed.json.order.promodiscount, 250);
  assert.equal(db.prepare("SELECT uses FROM promos WHERE code='LUNCHFIXED'").get().uses, 1);

  const singleItemOrder = await request('/orders', {
    method: 'POST',
    token: guestToken,
    body: {
      ...orderBody('02.11 | 17:00–17:30'),
      items: [{ id: 'lunch-pizza', oi: 1, qty: 1 }],
    },
  });
  assert.equal(singleItemOrder.status, 200, JSON.stringify(singleItemOrder.json));
  assert.equal(singleItemOrder.json.order.items.length, 1);
  assert.equal(singleItemOrder.json.order.items[0].qty, 1);
  assert.equal(singleItemOrder.json.order.total, 1200);

  const mine = await request('/orders/mine', { token: staffToken });
  const saved = (mine.json.orders || []).find((order) => order.id === staffLunch.json.order.id);
  assert.equal(saved.discount_label, '20% обеденная акция + 10% для своих');
});
