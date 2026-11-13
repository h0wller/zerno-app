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
const dbPath = path.join(os.tmpdir(), `zerno-sms-disabled-${randomUUID()}.db`);
let server;
let output = '';

async function get(pathname) {
  const response = await fetch(base + pathname);
  return { status: response.status, json: await response.json() };
}

async function post(pathname, body) {
  const response = await fetch(base + pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_PATH: dbPath,
      SMS_AUTH_ENABLED: 'false',
      SMSRU_API_ID: '',
      TELEGRAM_BOT_TOKEN: '',
      PUBLIC_URL: '',
      TG_WEBHOOK_SECRET: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += `\\nSpawn error: ${error.stack || error.message}`; });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Test server exited (code=${server.exitCode}):\\n${output}`);
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for test server:\\n${output}`);
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

test('SMS auth stays off by default, reports its state, and never becomes an implicit fallback', async () => {
  const config = await get('/api/config');
  assert.equal(config.status, 200);
  assert.equal(config.json.smsAuthEnabled, false);

  const registrationSms = await post('/api/auth/request-reg-otp', {
    phone: '+7 900 000-02-01',
    name: 'SMS Disabled Guest',
    via: 'sms'
  });
  assert.equal(registrationSms.status, 503);
  assert.match(registrationSms.json.error || '', /SMS.*отключено/i);

  const telegramRegistration = await post('/api/auth/request-reg-otp', {
    phone: '+7 900 000-02-02',
    name: 'Telegram Guest'
  });
  assert.equal(telegramRegistration.status, 200);
  assert.ok(telegramRegistration.json.tgUrl);
  assert.match(telegramRegistration.json.pollToken || '', /^[a-f0-9]{64}$/);

  const profile = await post('/api/auth/register', {
    name: 'Cashier Created Guest',
    phone: '+7 900 000-02-03',
    consent: true
  });
  assert.equal(profile.status, 200, JSON.stringify(profile.json));

  const loginOtp = await post('/api/auth/request-otp', {
    phone: '+7 900 000-02-03'
  });
  assert.equal(loginOtp.status, 503);
  assert.match(loginOtp.json.error || '', /Telegram/i);
});
