import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function reservePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

const port = await reservePort();
const base = `http://127.0.0.1:${port}`;
const root = path.resolve(import.meta.dirname, '../..');
const dbPath = path.join(os.tmpdir(), `zerno-auth-enforcement-${randomUUID()}.db`);
const adminCode = 'integration-auth-lockout-admin-2026';
let server;
let output = '';

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Test server exited (code=${server.exitCode}, signal=${server.signalCode ?? 'none'}):\n${output}`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for test server:\n${output}`);
}

async function api(route, body, token) {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function seedOtp(phone, code = '2468') {
  const result = await api('/__test/otp', {
    key: 'reg:' + phone,
    code,
    expiresInMs: 300000
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
}

async function registerVerified(name, phone) {
  await seedOtp(phone);
  const result = await api('/api/auth/register', {
    name,
    phone,
    pin: '1357',
    code: '2468',
    consent: true
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.ok(result.json.token);
  return result.json;
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_PATH: dbPath,
      TELEGRAM_BOT_TOKEN: '',
      PUBLIC_URL: '',
      TG_WEBHOOK_SECRET: 'integration-auth-lockout-secret',
      ADMIN_CODE: adminCode,
      CASHIER_CODE: '',
      DISPATCH_CODE: '',
      SMS_AUTH_ENABLED: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += `\nSpawn error: ${error.stack || error.message}`; });
  await waitForServer();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 4000))]);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('registration rejects an explicitly supplied incorrect OTP instead of issuing a session', async () => {
  const phone = '+7 900 000-31-01';
  await seedOtp(phone);

  const rejected = await api('/api/auth/register', {
    name: 'Wrong OTP Registration',
    phone,
    pin: '1234',
    code: '9999',
    consent: true
  });

  assert.equal(rejected.status, 403, JSON.stringify(rejected.json));
  assert.equal(rejected.json.token, undefined);

  const correctButLocked = await api('/api/auth/register', {
    name: 'Wrong OTP Registration',
    phone,
    pin: '1234',
    code: '2468',
    consent: true
  });
  assert.equal(correctButLocked.status, 429, JSON.stringify(correctButLocked.json));
  assert.equal(correctButLocked.json.token, undefined);
});

test('guest activation enforces the lockout before accepting a correct activation code', async () => {
  const adminPhone = '+7 900 000-31-02';
  const admin = await registerVerified('Activation Lock Admin', adminPhone);
  const promoted = await api('/api/auth/activate', { code: adminCode }, admin.token);
  assert.equal(promoted.status, 200, JSON.stringify(promoted.json));

  const guestPhone = '+7 900 000-31-03';
  const guest = await api('/api/auth/register', {
    name: 'Activation Lock Guest',
    phone: guestPhone,
    consent: true
  });
  assert.equal(guest.status, 200, JSON.stringify(guest.json));
  assert.ok(guest.json.token);

  const pendingResponse = await fetch(base + '/api/staff/pending', {
    headers: { authorization: 'Bearer ' + admin.token }
  });
  assert.equal(pendingResponse.status, 200);
  const pending = await pendingResponse.json();
  const target = pending.pending.find(row => row.phone === guestPhone);
  assert.ok(target?.actcode, 'authorized staff should see the pending activation code');

  for (let attempt = 0; attempt < 5; attempt++) {
    const rejected = await api('/api/auth/activate-guest', { code: '0000' }, guest.json.token);
    assert.equal(rejected.status, 403, JSON.stringify(rejected.json));
  }

  const correctButLocked = await api('/api/auth/activate-guest', {
    code: target.actcode
  }, guest.json.token);
  assert.equal(correctButLocked.status, 429, JSON.stringify(correctButLocked.json));
});
