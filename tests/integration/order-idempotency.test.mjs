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
  const result = await request('/auth/register', {
    method: 'POST',
    body: { name, phone, pin: '1234', consent: true },
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  return result.json.token;
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
  db.prepare("INSERT INTO meta(key,value) VALUES('order_no','40')");
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
