import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-link-preload-'));
const publicDir = path.join(tempDir, 'public');
const dishesDir = path.join(publicDir, 'media', 'dishes');
const dbPath = path.join(tempDir, 'test.db');
const root = path.resolve(import.meta.dirname, '../..');
const imagePath = '/media/dishes/preload-fixture-card.webp';
const deliveryImagePath = '/media/dishes/preload-fixture-delivery-card.webp';
const imageBytes = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64');
let child;
let db;
let serverOutput = '';

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
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for test server:\n' + serverOutput);
}

before(async () => {
  fs.mkdirSync(dishesDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>preload fixture</title>');
  fs.writeFileSync(path.join(dishesDir, 'preload-fixture-card.webp'), imageBytes);
  fs.writeFileSync(path.join(dishesDir, 'preload-fixture-delivery-card.webp'), imageBytes);
  const resizedDir = path.join(dishesDir, 'resized');
  fs.mkdirSync(resizedDir, { recursive: true });
  fs.writeFileSync(path.join(resizedDir, 'preload-fixture-delivery-card-300.webp'), imageBytes);
  fs.writeFileSync(path.join(resizedDir, 'preload-fixture-delivery-card-600.webp'), imageBytes);

  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_PATH: dbPath,
      PUBLIC_DIR: publicDir,
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
  db.prepare('UPDATE menu SET img=?, sort_order=-1 WHERE id=?').run(imagePath, 'esp');
  db.prepare('UPDATE menu SET img=?, sort_order=-1 WHERE id=?').run(deliveryImagePath, 'pz-marg');
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
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('explicit coffee document preloads the first existing local coffee image', async () => {
  const response = await fetch(base + '/?brand=coffee');
  assert.equal(response.status, 200);
  const link = response.headers.get('link');
  assert.ok(link, 'coffee HTML response must expose the first local dish image preload');
  assert.match(link, /rel=preload/);
  assert.match(link, /as=image/);
  assert.match(link, /fetchpriority=high/);
  assert.ok(link.includes('<' + imagePath + '>'), 'preload URL must match the selected image');
});

test('Lighthouse coffee audit preloads the first local coffee image without a brand query', async () => {
  const response = await fetch(base + '/?lighthouse=1');
  assert.equal(response.status, 200);
  const link = response.headers.get('link');
  assert.ok(link, 'Lighthouse coffee document must expose the first local dish image preload');
  assert.match(link, /rel=preload/);
  assert.match(link, /as=image/);
  assert.match(link, /fetchpriority=high/);
  assert.ok(link.includes('<' + imagePath + '>'), 'audit preload URL must match the selected coffee image');
});

test('explicit delivery document preloads its first responsive hero image', async () => {
  const response = await fetch(base + '/?brand=delivery');
  assert.equal(response.status, 200);
  const link = response.headers.get('link');
  assert.ok(link, 'delivery HTML response must expose its first local dish image preload');
  assert.ok(link.includes('<' + deliveryImagePath + '>'), 'preload must target the selected delivery hero');
  assert.match(link, /rel=preload/);
  assert.match(link, /as=image/);
  assert.match(link, /fetchpriority=high/);
  assert.match(link, /imagesrcset=/);
  assert.match(link, /preload-fixture-delivery-card-300\.webp/);
  assert.match(link, /preload-fixture-delivery-card-600\.webp/);
  assert.match(link, /imagesizes=/);
});

test('Lighthouse delivery audit preloads the first responsive delivery image', async () => {
  const response = await fetch(base + '/?lighthouse=1&brand=delivery');
  assert.equal(response.status, 200);
  const link = response.headers.get('link');
  assert.ok(link, 'delivery Lighthouse document must expose its first local dish image preload');
  assert.ok(link.includes('<' + deliveryImagePath + '>'));
  assert.match(link, /imagesrcset=/);
  assert.match(link, /imagesizes=/);
});

test('default splash and delivery documents do not preload a coffee image', async () => {
  for (const route of ['/', '/?brand=delivery', '/?lighthouse=1&brand=delivery', '/?clean=1&brand=delivery']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('link'), null, route + ' must not advertise the coffee image');
  }
});
