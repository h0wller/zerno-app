import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const port = 43000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const dbPath = path.join(os.tmpdir(), `zerno-auth-test-${randomUUID()}.db`);
let server;
let output = '';

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Test server exited (${server.exitCode}):\n${output}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for test server:\n${output}`);
}

async function api(route, body) {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function seedOtp(key, code, expiresInMs = 300000) {
  const result = await api('/__test/otp', { key, code, expiresInMs });
  assert.equal(result.status, 200, JSON.stringify(result.json));
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_PATH: dbPath,
      TG_WEBHOOK_SECRET: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
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

test('registration without consent neither creates a usable profile nor consumes OTP', async () => {
  const phone = '+79000000101';
  const key = 'reg:' + phone;
  await seedOtp(key, '2468');

  const rejected = await api('/api/auth/register', {
    name: 'Consent Test', phone, pin: '1234', code: '2468'
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.json.error || '', /согласие/i);

  const accepted = await api('/api/auth/register', {
    name: 'Consent Test', phone, pin: '1234', code: '2468', consent: true
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
  assert.ok(accepted.json.token);
  assert.ok(accepted.json.customer?.id);
});

test('OTP login rejects wrong and expired codes, then consumes a valid code once', async () => {
  const phone = '+79000000102';
  const registered = await api('/api/auth/register', {
    name: 'OTP Test', phone, pin: '1234', consent: true
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.json));

  await seedOtp(phone, '5731');
  const wrong = await api('/api/auth/login', { phone, otp: '9999' });
  assert.equal(wrong.status, 403);
  assert.match(wrong.json.error || '', /неверн/i);

  const valid = await api('/api/auth/login', { phone, otp: '5731' });
  assert.equal(valid.status, 200, JSON.stringify(valid.json));
  assert.ok(valid.json.token);

  const replay = await api('/api/auth/login', { phone, otp: '5731' });
  assert.equal(replay.status, 403);
  assert.match(replay.json.error || '', /просрочен/i);

  await seedOtp(phone, '6842', 0);
  const expired = await api('/api/auth/login', { phone, otp: '6842' });
  assert.equal(expired.status, 403);
  assert.match(expired.json.error || '', /просрочен/i);
});
