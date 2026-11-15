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
  await new Promise(resolve => server.close(resolve));
  return port;
}

const port = await reservePort();
const base = 'http://127.0.0.1:' + port;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-production-order-'));
const dbPath = path.join(tempDir, 'production-tmp.sqlite');
const clockPath = path.join(tempDir, 'fixed-clock.mjs');
const root = path.resolve(import.meta.dirname, '../..');
const frozenNow = '2026-11-15T20:00:00.000Z'; // 22:00 in Europe/Kaliningrad
const fullSlot = '16.11 | 12:00–12:30';
const token = randomUUID();
const customerId = 'production-order-test-customer';
let child;
let db;
let serverOutput = '';

async function request(body) {
  const response = await fetch(base + '/api/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(body),
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('Production-mode test server exited (' + child.exitCode + '):\n' + serverOutput);
    }
    try {
      const health = await fetch(base + '/api/health');
      if (health.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for production-mode test server:\n' + serverOutput);
}

before(async () => {
  fs.writeFileSync(clockPath, `
const RealDate = Date;
const fixedNow = ${JSON.stringify(frozenNow)};
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]));
  }
  static now() {
    return new RealDate(fixedNow).valueOf();
  }
};
`);

  child = spawn(process.execPath, ['--import', clockPath, 'server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DB_PATH: dbPath,
      PORT: String(port),
      TELEGRAM_BOT_TOKEN: '',
      TG_WEBHOOK_SECRET: '',
      SMS_AUTH_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await waitForServer();

  db = new Database(dbPath);
  const issuedAt = Date.now();
  db.prepare(`
    INSERT INTO customers(id,name,phone,verified,role,created_at)
    VALUES(?,?,?,1,'guest',?)
  `).run(customerId, 'Production Order Guest', '+7 900 300-00-01', new Date(issuedAt).toISOString());
  db.prepare(`
    INSERT INTO tokens(token,kind,ref,ts,expires_at)
    VALUES(?,'user',?,?,?)
  `).run(token, customerId, new Date(issuedAt).toISOString(), issuedAt + 86400000);
  db.prepare(`
    INSERT INTO menu(
      id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,section,opts,sort_order
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'production-order-pizza', 'pizza', '🍕', 'Тестовая пицца', '', '[]', '', '800', '',
    0, 1, null, 'delivery', '[]', 1,
  );
  const insertOrder = db.prepare(`
    INSERT INTO orders(
      id,no,cid,name,phone,method,place,addr,slot,pay,comment,items,total,
      discount,discount_label,fee,gifts,is_preorder,preorder_date,status,created,updated
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,'new',?,?)
  `);
  for (const [id, no] of [['filled-slot-one', 1], ['filled-slot-two', 2]]) {
    insertOrder.run(
      id, no, 'other-customer-' + id, 'Other Guest', '+7 900 300-00-02',
      'delivery', 'Янтарный', 'Советская 2', fullSlot, 'cash', '',
      '[]', 800, 0, '', 200, '[]', '16.11',
      new Date(issuedAt).toISOString(), new Date(issuedAt).toISOString(),
    );
  }
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
  try { fs.unlinkSync(clockPath); } catch {}
  try { fs.rmdirSync(tempDir); } catch {}
});

test('production rejects ASAP after delivery hours even when DB_PATH contains tmp', async () => {
  const result = await request({
    method: 'delivery',
    place: 'Янтарный',
    addr: 'Советская 1',
    slot: 'asap',
    pay: 'cash',
    items: [{ id: 'production-order-pizza', qty: 1 }],
  });

  assert.equal(result.status, 400, JSON.stringify(result.json));
  assert.match(result.json.error || '', /закрыта|недостаточно времени/i);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE cid=?').get(customerId).n, 0);
});

test('production enforces preorder slot quota even when DB_PATH contains tmp', async () => {
  const result = await request({
    method: 'delivery',
    place: 'Янтарный',
    addr: 'Советская 1',
    slot: fullSlot,
    pay: 'cash',
    items: [{ id: 'production-order-pizza', qty: 1 }],
  });

  assert.equal(result.status, 409, JSON.stringify(result.json));
  assert.match(result.json.error || '', /полностью заполнен/i);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM orders WHERE slot=? AND status NOT IN (\'cancel\', \'done\') AND is_preorder=1')
      .get(fullSlot).n,
    2,
  );
});
