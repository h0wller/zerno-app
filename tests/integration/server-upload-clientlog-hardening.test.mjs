import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ADMIN_CODE = 'ci-zerno-admin-code-2026';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-upload-clientlog-'));
const publicDir = path.join(tempRoot, 'public');
const dbPath = path.join(tempRoot, 'zerno.db');
const root = path.resolve(import.meta.dirname, '../..');
let port;
let base;
let server;
let output = '';
let adminToken = '';

async function reservePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const value = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return value;
}

async function send(pathname, body, token, raw = false, forwardedFor = '') {
  const headers = { 'content-type': 'application/json' };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  if (token) headers.authorization = 'Bearer ' + token;
  const response = await fetch(base + pathname, {
    method: 'POST',
    headers,
    body: raw ? body : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: response.status, headers: response.headers, json };
}

before(async () => {
  port = await reservePort();
  base = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_PATH: dbPath,
      PUBLIC_DIR: publicDir,
      ADMIN_CODE,
      TELEGRAM_BOT_TOKEN: '',
      TG_WEBHOOK_SECRET: '',
      PUBLIC_URL: '',
      TRUST_PROXY: '1',
      HOST: '',
      SMS_AUTH_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += '\nSpawn error: ' + (error.stack || error.message); });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Test server exited: ' + output);
    try {
      const response = await fetch(base + '/api/ready');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for test server:\n' + output);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 4000))]);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('server listens only on loopback unless an explicit HOST is configured', async () => {
  const interfaceAddress = Object.values(os.networkInterfaces())
    .flat()
    .find(address => address && address.family === 'IPv4' && !address.internal)?.address;
  assert.ok(interfaceAddress, 'integration environment must expose a non-loopback IPv4 interface');

  const connected = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: interfaceAddress, port });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', error => {
      if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'].includes(error.code)) {
        resolve(false);
      } else {
        reject(error);
      }
    });
  });

  assert.equal(connected, false, 'default server binding must not expose the app on a non-loopback interface');
});

test('menu image upload validates input before processing and stores only bounded raster images', async () => {
  const unauthenticated = await send('/api/menu/upload', { data: 'not-an-image' });
  assert.equal(unauthenticated.status, 401);

  const digits = '9' + String(Date.now()).slice(-9);
  const registration = await send('/api/auth/register', {
    name: 'Upload Admin',
    phone: '+7' + digits,
    consent: 1
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.json));
  adminToken = registration.json.token;
  assert.ok(adminToken);

  const activation = await send('/api/auth/activate', { code: ADMIN_CODE }, adminToken);
  assert.equal(activation.status, 200, JSON.stringify(activation.json));

  const unsupported = await send('/api/menu/upload', {
    id: 'unsupported',
    data: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
  }, adminToken);
  assert.equal(unsupported.status, 400);

  const malformed = await send('/api/menu/upload', {
    id: 'malformed',
    data: 'data:image/png;base64,%%%not-base64%%%'
  }, adminToken);
  assert.equal(malformed.status, 400);

  const mismatchedMime = await send('/api/menu/upload', {
    id: 'wrong-mime',
    data: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/SxsAAAAASUVORK5CYII='
  }, adminToken);
  assert.equal(mismatchedMime.status, 400);

  const oversizedBase64 = Buffer.alloc(MAX_UPLOAD_BYTES + 1).toString('base64');
  const oversized = await send('/api/menu/upload', {
    id: 'oversized',
    data: 'data:image/png;base64,' + oversizedBase64
  }, adminToken);
  assert.equal(oversized.status, 413);

  const tooManyPixelsBuffer = await sharp({
    create: { width: 2500, height: 2500, channels: 3, background: '#ffffff' }
  }).png().toBuffer();
  const tooManyPixels = await send('/api/menu/upload', {
    id: 'too-many-pixels',
    data: 'data:image/png;base64,' + tooManyPixelsBuffer.toString('base64')
  }, adminToken);
  assert.equal(tooManyPixels.status, 400);

  const validBuffer = await sharp({
    create: { width: 32, height: 24, channels: 3, background: '#cc2233' }
  }).png().toBuffer();
  const valid = await send('/api/menu/upload', {
    id: 'test-dish',
    data: 'data:image/png;base64,' + validBuffer.toString('base64')
  }, adminToken);
  assert.equal(valid.status, 200, JSON.stringify(valid.json));
  assert.equal(valid.json.ok, true);
  assert.ok(fs.existsSync(path.join(publicDir, 'media/dishes/test-dish-card.webp')));
  assert.ok(fs.existsSync(path.join(publicDir, 'media/dishes/test-dish-zoom.webp')));
  assert.ok(fs.existsSync(path.join(publicDir, 'media/dishes/resized/test-dish-card-300.webp')));
  assert.ok(fs.existsSync(path.join(publicDir, 'media/dishes/resized/test-dish-card-600.webp')));
});

test('client diagnostics have a small body limit and a per-IP request window', async () => {
  const accepted = await send('/api/clientlog', { kind: 'test', msg: 'ok' });
  assert.equal(accepted.status, 200);

  const tooLarge = await send('/api/clientlog', {
    kind: 'test',
    msg: 'x'.repeat(5000)
  });
  assert.equal(tooLarge.status, 413);

  const remaining = await Promise.all(Array.from({ length: 58 }, () =>
    send('/api/clientlog', { kind: 'test', msg: 'ok' })
  ));
  assert.ok(remaining.every(result => result.status === 200),
    'all requests within the configured window should be accepted');

  const limited = await send('/api/clientlog', { kind: 'test', msg: 'over-limit' });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);

  const independentIp = await send('/api/clientlog', { kind: 'test', msg: 'other client' }, undefined, false, '203.0.113.15');
  assert.equal(independentIp.status, 200, 'another forwarded client IP must have an independent request window');
});
