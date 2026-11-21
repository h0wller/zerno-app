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
const sauceImagePath = '/media/dishes/preload-fixture-sauce-card.webp';
const imageBytes = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64');
function webpHeader(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(22, 4);
  buffer.write('WEBP', 8);
  buffer.write('VP8X', 12);
  buffer.writeUInt32LE(10, 16);
  buffer[24] = (width - 1) & 0xff;
  buffer[25] = ((width - 1) >> 8) & 0xff;
  buffer[26] = ((width - 1) >> 16) & 0xff;
  buffer[27] = (height - 1) & 0xff;
  buffer[28] = ((height - 1) >> 8) & 0xff;
  buffer[29] = ((height - 1) >> 16) & 0xff;
  return buffer;
}
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
  fs.writeFileSync(path.join(dishesDir, 'preload-fixture-delivery-card.webp'), webpHeader(600, 375));
  fs.writeFileSync(path.join(dishesDir, 'preload-fixture-sauce-card.webp'), imageBytes);
  const resizedDir = path.join(dishesDir, 'resized');
  fs.mkdirSync(resizedDir, { recursive: true });
  fs.writeFileSync(path.join(resizedDir, 'preload-fixture-delivery-card-300.webp'), webpHeader(300, 188));
  // The square 600px derivative is intentionally larger than the 600x375 original.
  fs.writeFileSync(
    path.join(resizedDir, 'preload-fixture-delivery-card-600.webp'),
    Buffer.concat([webpHeader(600, 600), Buffer.alloc(1024, 0)])
  );

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
  db.prepare("UPDATE menu SET cat='sauces', img=?, sort_order=-2 WHERE id=?").run(sauceImagePath, 'pz-marg');
  db.prepare("UPDATE menu SET cat='pizza', img=?, sort_order=-1 WHERE id=?").run(deliveryImagePath, 'pz-hamgr');
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

test('delivery document preloads the first visible pizza when a sauce sorts before it', async () => {
  const response = await fetch(base + '/?brand=delivery');
  assert.equal(response.status, 200);
  const link = response.headers.get('link');
  assert.ok(link, 'delivery HTML response must expose its first visible pizza image preload');
  assert.ok(link.includes('<' + deliveryImagePath + '>'), 'preload must target the first pizza, not the earlier sauce');
  assert.doesNotMatch(link, /preload-fixture-sauce-card/);
  assert.match(link, /rel=preload/);
  assert.match(link, /as=image/);
  assert.match(link, /fetchpriority=high/);
  assert.match(link, /imagesrcset=/);
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
  assert.ok(link.includes(deliveryImagePath + ' 600w'), 'smaller original must replace the oversized 600px derivative');
  assert.doesNotMatch(link, /preload-fixture-delivery-card-600\.webp/);
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

test('C7 benchmark patch predicts catalog JSON without DOM or image preload ownership', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/prepare-lighthouse-variant.mjs'), 'utf8');
  const start = source.indexOf("else if(variant==='C7'){");
  const end = source.indexOf("\nelse if(variant==='F')", start);
  assert.ok(start >= 0 && end > start, 'C7 benchmark patch generator must exist');
  const c7 = source.slice(start, end);
  assert.match(c7, /earlyCatalog/);
  assert.match(c7, /nativeFetch\.call\(window, predictedEndpoint/);
  assert.doesNotMatch(c7, /document\.createElement|document\.getElementById|appendChild|rel\s*=\s*['"]preload['"]/,
    'C7 must fetch catalog JSON only and must not mutate catalog DOM or create image preloads');
});

test('forced splash does not emit a server image preload', async () => {
  const response = await fetch(base + '/?splash=1');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('link'), null);
});

test('default splash has no catalog preload and delivery documents do not preload coffee', async () => {
  const splashResponse = await fetch(base + '/');
  assert.equal(splashResponse.status, 200);
  assert.equal(splashResponse.headers.get('link'), null, 'splash must not preselect either brand image');

  for (const route of ['/?brand=delivery', '/?lighthouse=1&brand=delivery', '/?clean=1&brand=delivery']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    const link = response.headers.get('link');
    assert.ok(link, route + ' must preload the selected delivery hero');
    assert.ok(link.includes('<' + deliveryImagePath + '>'), route + ' must not preload a coffee image');
  }
});
