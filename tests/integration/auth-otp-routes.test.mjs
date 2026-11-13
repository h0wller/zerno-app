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
const dbPath = path.join(os.tmpdir(), `zerno-auth-test-${randomUUID()}.db`);
let server;
let output = '';

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Test server exited (code=${server.exitCode}, signal=${server.signalCode ?? 'none'}):\n${output}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
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

async function webhook(payload) {
  const response = await fetch(base + '/api/tg/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': 'integration-test-secret'
    },
    body: JSON.stringify(payload)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
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
      TG_WEBHOOK_SECRET: 'integration-test-secret',
      ADMIN_CODE: 'integration-test-admin',
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

test('registration without consent neither creates a usable profile nor consumes OTP', async () => {
  const phone = '+7 900 000-01-01';
  const key = 'reg:+7 900 000-01-01';
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


test('cashier-created profile requires phone proof before first PIN is set', async () => {
  const adminPhone = '+7 900 000-01-10';
  await seedOtp('reg:' + adminPhone, '2468');
  const admin = await api('/api/auth/register', {
    name: 'Auth Test Admin', phone: adminPhone, pin: '1357', code: '2468', consent: true
  });
  assert.equal(admin.status, 200, JSON.stringify(admin.json));

  const promoted = await api('/api/auth/activate', { code: 'integration-test-admin' }, admin.json.token);
  assert.equal(promoted.status, 200, JSON.stringify(promoted.json));
  assert.equal(promoted.json.customer?.role, 'admin');

  const phone = '+7 900 000-01-11';
  const created = await api('/api/staff/customers', {
    name: 'Cashier Created Guest', phone
  }, admin.json.token);
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.customer?.verified, 1);

  const anonymousSetup = await api('/api/auth/setup-pin', { phone, pin: '4321' });
  assert.equal(anonymousSetup.status, 401);
  assert.equal(anonymousSetup.json.token, undefined);

  const anonymousLogin = await api('/api/auth/login', { phone, pin: '4321' });
  assert.equal(anonymousLogin.status, 409);
  assert.equal(anonymousLogin.json.token, undefined);

  const otpRequest = await api('/api/auth/request-otp', { phone });
  assert.equal(otpRequest.status, 200, JSON.stringify(otpRequest.json));
  assert.equal(otpRequest.json.via, 'sms');

  await seedOtp(phone, '5731');
  const verifiedLogin = await api('/api/auth/login', { phone, otp: '5731' });
  assert.equal(verifiedLogin.status, 200, JSON.stringify(verifiedLogin.json));
  assert.equal(verifiedLogin.json.needPin, true);

  const pinSetup = await api('/api/auth/setup-pin', { pin: '4321' }, verifiedLogin.json.token);
  assert.equal(pinSetup.status, 200, JSON.stringify(pinSetup.json));
  assert.equal(pinSetup.json.customer?.id, created.json.customer.id);

  const pinLogin = await api('/api/auth/login', { phone, pin: '4321' });
  assert.equal(pinLogin.status, 200, JSON.stringify(pinLogin.json));
  assert.ok(pinLogin.json.token);
});

test('Telegram registration polling is scoped to a random one-attempt secret, not the phone number', async () => {
  const phone = '+7 900 000-01-12';
  const requested = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, via: 'tg'
  });
  assert.equal(requested.status, 200, JSON.stringify(requested.json));
  assert.match(requested.json.pollToken || '', /^[a-f0-9]{64}$/);

  const throttled = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, via: 'tg'
  });
  assert.equal(throttled.status, 429);

  const botToken = new URL(requested.json.tgUrl).searchParams.get('start')?.replace(/^reg_/, '');
  assert.ok(botToken);

  const chatId = 900000112;
  const started = await webhook({
    message: { chat: { id: chatId }, from: { id: chatId }, text: '/start reg_' + botToken }
  });
  assert.equal(started.status, 200, JSON.stringify(started.json));

  const confirmed = await webhook({
    message: {
      chat: { id: chatId },
      from: { id: chatId, first_name: 'Telegram Poll Guest' },
      contact: { phone_number: phone, user_id: chatId }
    }
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.json));

  const phoneLookup = await api('/api/auth/check-reg', { phone });
  assert.equal(phoneLookup.status, 400);
  assert.equal(phoneLookup.json.token, undefined);

  const wrongPoll = await api('/api/auth/check-reg', { pollToken: 'b'.repeat(64) });
  assert.equal(wrongPoll.status, 200);
  assert.equal(wrongPoll.json.confirmed, false);
  assert.equal(wrongPoll.json.token, undefined);

  const validPoll = await api('/api/auth/check-reg', { pollToken: requested.json.pollToken });
  assert.equal(validPoll.status, 200, JSON.stringify(validPoll.json));
  assert.equal(validPoll.json.confirmed, true);
  assert.ok(validPoll.json.token);
  assert.equal(validPoll.json.customer?.phone, phone);

  const replayedPoll = await api('/api/auth/check-reg', { pollToken: requested.json.pollToken });
  assert.equal(replayedPoll.status, 200);
  assert.equal(replayedPoll.json.confirmed, false);
  assert.equal(replayedPoll.json.token, undefined);
});

test('OTP login rejects wrong and expired codes, then consumes a valid code once', async () => {
  const phone = '+7 900 000-01-02';
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
