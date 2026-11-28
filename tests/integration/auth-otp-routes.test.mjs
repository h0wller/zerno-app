import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../fixtures/mock-telegram-fetch.mjs';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

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
let inspectDb;
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

function capturedTelegramMessages() {
  return output.split(/\r?\n/)
    .filter(line => line.startsWith('[TG_MOCK]'))
    .map(line => {
      try { return JSON.parse(line.slice('[TG_MOCK]'.length)); } catch { return null; }
    })
    .filter(entry => entry?.method === 'sendMessage')
    .map(entry => entry.payload);
}

async function waitForTelegramMessage(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = capturedTelegramMessages().find(predicate);
    if (message) return message;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for Telegram message. Captured messages: ' +
    JSON.stringify(capturedTelegramMessages()));
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_PATH: dbPath,
      TELEGRAM_BOT_TOKEN: 'integration-test-bot-token',
      ZERNO_MOCK_TELEGRAM_FETCH: '1',
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=' + pathToFileURL(path.join(root, 'tests/fixtures/mock-telegram-fetch.mjs')).href].filter(Boolean).join(' '),
      PUBLIC_URL: '',
      TG_WEBHOOK_SECRET: 'integration-test-secret',
      TG_BOT_USERNAME: 'test_bot',
      ADMIN_CODE: 'integration-test-admin',
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
  inspectDb = new Database(dbPath);
});

after(async () => {
  if (inspectDb) { try { inspectDb.close(); } catch {} }
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


test('cashier activation code verifies a pending profile and grants the welcome benefit once', async () => {
  const phone = '+7 900 000-01-16';
  const pending = await api('/api/auth/register', {
    name: 'P0 Cashier Activation',
    phone,
    pin: '1357',
    consent: true
  });
  assert.equal(pending.status, 200, JSON.stringify(pending.json));
  assert.ok(pending.json.token);
  assert.equal(pending.json.customer?.verified, 0);

  const pendingRow = inspectDb.prepare(
    'SELECT actcode, verified FROM customers WHERE id=?'
  ).get(pending.json.customer.id);
  assert.equal(pendingRow?.verified, 0);
  assert.match(pendingRow?.actcode || '', /^\d{4}$/);

  const activation = await api(
    '/api/auth/activate-guest',
    { code: pendingRow.actcode },
    pending.json.token
  );
  assert.equal(activation.status, 200, JSON.stringify(activation.json));
  assert.equal(activation.json.customer?.verified, 1);
  assert.equal(activation.json.customer?.free, 1);

  const activatedRow = inspectDb.prepare(
    'SELECT actcode, verified FROM customers WHERE id=?'
  ).get(pending.json.customer.id);
  assert.equal(activatedRow?.verified, 1);
  assert.equal(activatedRow?.actcode, null);

  const grants = () => inspectDb.prepare(
    "SELECT COUNT(*) AS count FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')"
  ).get(pending.json.customer.id).count;
  assert.equal(grants(), 1);

  const deliveryResponse = await fetch(base + '/api/me/free-delivery', {
    headers: { authorization: 'Bearer ' + pending.json.token }
  });
  assert.equal(deliveryResponse.status, 200);
  const delivery = await deliveryResponse.json();
  assert.match(delivery.code || '', /^B[0-9A-F]{8}$/);

  const duplicateActivation = await api(
    '/api/auth/activate-guest',
    { code: pendingRow.actcode },
    pending.json.token
  );
  assert.equal(duplicateActivation.status, 409);
  assert.equal(grants(), 1);
});

test('cashier activation does not invent a welcome gift when bonus_cfg disables it', async () => {
  const bonusKey = "SELECT value FROM meta WHERE key='bonus_cfg'";
  const previousConfig = inspectDb.prepare(bonusKey).get();
  const disabledConfig = {
    days: 30,
    kinds: {
      signup: { coffee: 0, delivery: 0, freeFirstDelivery: 0 },
      qr: { coffee: 0, delivery: 0, freeFirstDelivery: 0 },
      install: { coffee: 0, delivery: 0, freeFirstDelivery: 0 }
    }
  };

  try {
    inspectDb.prepare(
      "INSERT INTO meta(key,value) VALUES('bonus_cfg',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(disabledConfig));

    const phone = '+7 900 000-01-17';
    const pending = await api('/api/auth/register', {
      name: 'P0 No Welcome Gift',
      phone,
      pin: '1357',
      consent: true
    });
    assert.equal(pending.status, 200, JSON.stringify(pending.json));
    assert.equal(pending.json.customer?.verified, 0);

    const pendingRow = inspectDb.prepare(
      'SELECT actcode FROM customers WHERE id=?'
    ).get(pending.json.customer.id);
    assert.match(pendingRow?.actcode || '', /^\d{4}$/);

    const activation = await api(
      '/api/auth/activate-guest',
      { code: pendingRow.actcode },
      pending.json.token
    );
    assert.equal(activation.status, 200, JSON.stringify(activation.json));
    assert.equal(activation.json.customer?.verified, 1);
    assert.equal(activation.json.customer?.free, 0);
    assert.equal(activation.json.customer?.stamps, 0);

    const grants = inspectDb.prepare(
      "SELECT COUNT(*) AS count FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')"
    ).get(pending.json.customer.id).count;
    assert.equal(grants, 0);

    const deliveryResponse = await fetch(base + '/api/me/free-delivery', {
      headers: { authorization: 'Bearer ' + pending.json.token }
    });
    assert.equal(deliveryResponse.status, 200);
    assert.equal((await deliveryResponse.json()).code, null);
  } finally {
    if (previousConfig) {
      inspectDb.prepare(
        "UPDATE meta SET value=? WHERE key='bonus_cfg'"
      ).run(previousConfig.value);
    } else {
      inspectDb.prepare("DELETE FROM meta WHERE key='bonus_cfg'").run();
    }
  }
});

test('pending guest activates through a one-time Telegram pairing link using their own matching contact', async () => {
  const bonusKey = "SELECT value FROM meta WHERE key='bonus_cfg'";
  const previousConfig = inspectDb.prepare(bonusKey).get();
  const enabledConfig = {
    days: 30,
    kinds: {
      signup: { coffee: 10, delivery: 0, freeFirstDelivery: 1 },
      qr: { coffee: 10, delivery: 0, freeFirstDelivery: 1 },
      install: { coffee: 0, delivery: 0, freeFirstDelivery: 0 }
    }
  };
  inspectDb.prepare(
    "INSERT INTO meta(key,value) VALUES('bonus_cfg',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(JSON.stringify(enabledConfig));
  try {
  const phone = '+7 900 000-01-31';
  const pending = await api('/api/auth/register', {
    name: 'TG Activation Guest',
    phone,
    pin: '2468',
    consent: true
  });
  assert.equal(pending.status, 200, JSON.stringify(pending.json));
  assert.equal(pending.json.customer?.verified, 0);

  const returnTo = '/?brand=delivery&tab=profile#profile';
  const anonymous = await api('/api/auth/tg-link/request', { returnTo });
  assert.equal(anonymous.status, 401);

  const unsafeReturn = await api('/api/auth/tg-link/request', {
    returnTo: 'https://evil.example/collect'
  }, pending.json.token);
  assert.equal(unsafeReturn.status, 400);

  const requested = await api('/api/auth/tg-link/request', { returnTo }, pending.json.token);
  assert.equal(requested.status, 200, JSON.stringify(requested.json));
  assert.equal(requested.json.ok, true);
  const telegramUrl = new URL(requested.json.tgUrl);
  assert.equal(telegramUrl.hostname, 't.me');
  assert.equal(telegramUrl.pathname, '/test_bot');
  const startPayload = telegramUrl.searchParams.get('start') || '';
  assert.match(startPayload, /^activate_[a-f0-9]{48}$/);
  const activationToken = startPayload.slice('activate_'.length);
  const challengeState = await api('/__test/otp/inspect', { key: 'tgactivate:' + activationToken });
  assert.equal(challengeState.status, 200, JSON.stringify(challengeState.json));
  assert.equal(challengeState.json.exists, true);
  assert.equal(challengeState.json.customerId, String(pending.json.customer.id));
  assert.equal(challengeState.json.phone, phone);
  assert.equal(telegramUrl.searchParams.has('auth_token'), false);
  assert.equal(telegramUrl.searchParams.has('token'), false);

  const chatId = 900000131;
  const start = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'TG Activation Guest' },
      text: '/start ' + startPayload
    }
  });
  assert.equal(start.status, 200);
  const chatState = await api('/__test/otp/inspect', { key: 'tgactivate-chat:' + chatId });
  assert.equal(chatState.status, 200, JSON.stringify(chatState.json));
  assert.equal(chatState.json.exists, true);
  assert.equal(chatState.json.token, activationToken);
  assert.equal(chatState.json.customerId, String(pending.json.customer.id));

  const foreignContact = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId },
      contact: { phone_number: phone, user_id: chatId + 1 }
    }
  });
  assert.equal(foreignContact.status, 200);
  const afterForeignContact = inspectDb.prepare(
    'SELECT verified, tg FROM customers WHERE id=?'
  ).get(pending.json.customer.id);
  assert.equal(afterForeignContact?.verified, 0);
  assert.equal(afterForeignContact?.tg, null);

  const wrongPhone = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId },
      contact: { phone_number: '+7 900 000-01-32', user_id: chatId }
    }
  });
  assert.equal(wrongPhone.status, 200);
  assert.equal(
    inspectDb.prepare('SELECT verified FROM customers WHERE id=?').get(pending.json.customer.id)?.verified,
    0
  );

  const confirmed = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'TG Activation Guest' },
      contact: { phone_number: phone, user_id: chatId }
    }
  });
  assert.equal(confirmed.status, 200);

  const activationMessage = await waitForTelegramMessage(message => (
    String(message.chat_id) === String(chatId) &&
    /Номер подтверждён, профиль активирован/.test(message.text || '') &&
    /Карта:/.test(message.text || '')
  ));
  assert.match(activationMessage.text, /🎁 Приветственный бонус начислен:/);
  assert.match(activationMessage.text, /бесплатных кофе: <b>1<\/b>/);
  assert.match(activationMessage.text, /Персональная бесплатная первая доставка доступна/);
  assert.match(activationMessage.text, /подставит его автоматически/);
  const returnMessage = await waitForTelegramMessage(message => (
    String(message.chat_id) === String(chatId) && /Вернитесь в приложение/.test(message.text || '')
  ));
  const returnButton = returnMessage.reply_markup?.inline_keyboard?.[0]?.[0];
  assert.equal(returnButton?.text, 'Вернуться в приложение');
  const returnedUrl = new URL(returnButton.url);
  assert.equal(returnedUrl.origin, 'https://friday.andcoffee.online');
  assert.equal(returnedUrl.searchParams.get('brand'), 'delivery');
  assert.equal(returnedUrl.searchParams.get('tab'), 'profile');
  assert.equal(returnedUrl.hash, '#profile');
  const activationStateAfterContact = await api('/__test/otp/inspect', {
    key: 'tgactivate:' + activationToken
  });
  const chatStateAfterContact = await api('/__test/otp/inspect', {
    key: 'tgactivate-chat:' + chatId
  });
  assert.equal(activationStateAfterContact.json.exists, false, JSON.stringify(activationStateAfterContact.json));
  assert.equal(chatStateAfterContact.json.exists, false, JSON.stringify(chatStateAfterContact.json));
  const activated = inspectDb.prepare(
    'SELECT verified, tg, actcode, role, phone FROM customers WHERE id=?'
  ).get(pending.json.customer.id);
  const telegramOwners = inspectDb.prepare(
    'SELECT id, phone, role FROM customers WHERE tg=?'
  ).all(String(chatId));
  assert.equal(activated?.verified, 1, JSON.stringify({
    activated,
    activationStateAfterContact: activationStateAfterContact.json,
    chatStateAfterContact: chatStateAfterContact.json,
    telegramOwners,
    serverOutput: output
  }));
  assert.equal(String(activated?.tg), String(chatId));
  assert.equal(activated?.actcode, null);
  const bonusGrants = () => inspectDb.prepare(
    "SELECT COUNT(*) AS count FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')"
  ).get(pending.json.customer.id).count;
  assert.equal(bonusGrants(), 1);
  const grantsAfterFirstActivation = bonusGrants();

  const replay = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'TG Activation Guest' },
      text: '/start ' + startPayload
    }
  });
  assert.equal(replay.status, 200);
  assert.equal(
    inspectDb.prepare('SELECT verified FROM customers WHERE id=?').get(pending.json.customer.id)?.verified,
    1
  );
  assert.equal(bonusGrants(), grantsAfterFirstActivation);
  } finally {
    if (previousConfig) {
      inspectDb.prepare("UPDATE meta SET value=? WHERE key='bonus_cfg'").run(previousConfig.value);
    } else {
      inspectDb.prepare("DELETE FROM meta WHERE key='bonus_cfg'").run();
    }
  }
});

test('cashier-created guests get a PIN immediately and duplicate registration reuses the same profile', async () => {
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
    name: 'Cashier Created Guest', phone, pin: '4321'
  }, admin.json.token);
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.customer?.verified, 1);
  assert.equal(created.json.created, true);
  assert.equal(created.json.pinSet, true);

  const invalidPin = await api('/api/auth/login', { phone, pin: '9999' });
  assert.equal(invalidPin.status, 403);

  const pinLogin = await api('/api/auth/login', { phone, pin: '4321' });
  assert.equal(pinLogin.status, 200, JSON.stringify(pinLogin.json));
  assert.ok(pinLogin.json.token);
  assert.equal(pinLogin.json.customer?.id, created.json.customer.id);

  const duplicate = await api('/api/staff/customers', {
    name: 'Different Name Must Not Replace Existing', phone: '8 900 000-01-11', pin: '9999'
  }, admin.json.token);
  assert.equal(duplicate.status, 200, JSON.stringify(duplicate.json));
  assert.equal(duplicate.json.customer?.id, created.json.customer.id);
  assert.equal(duplicate.json.reused, true);
  assert.equal(duplicate.json.pinPreserved, true);

  const originalPinStillWorks = await api('/api/auth/login', { phone, pin: '4321' });
  assert.equal(originalPinStillWorks.status, 200, JSON.stringify(originalPinStillWorks.json));
  const replacementPinRejected = await api('/api/auth/login', { phone, pin: '9999' });
  assert.equal(replacementPinRejected.status, 403);

  const crossPathDuplicate = await api('/api/auth/register', {
    name: 'Duplicate Auth Guest', phone, pin: '7777', consent: true
  });
  assert.equal(crossPathDuplicate.status, 409, JSON.stringify(crossPathDuplicate.json));

  const pendingPhone = '+7 900 000-09-91';
  const pending = await api('/api/auth/register', {
    name: 'Existing Pending Guest', phone: pendingPhone, consent: true
  });
  assert.equal(pending.status, 200, JSON.stringify(pending.json));
  assert.equal(pending.json.customer?.verified, 0);

  const activated = await api('/api/staff/customers', {
    name: 'Existing Pending Guest', phone: '8 900 000-09-91', pin: '2468'
  }, admin.json.token);
  assert.equal(activated.status, 200, JSON.stringify(activated.json));
  assert.equal(activated.json.customer?.id, pending.json.customer.id);
  assert.equal(activated.json.reused, true);
  assert.equal(activated.json.pinSet, true);

  const activatedLogin = await api('/api/auth/login', { phone: pendingPhone, pin: '2468' });
  assert.equal(activatedLogin.status, 200, JSON.stringify(activatedLogin.json));
});

test('Telegram registration polling is scoped to a random one-attempt secret, not the phone number', async () => {
  const phone = '+7 900 000-01-12';
  const returnTo = '/?brand=coffee&tab=profile';
  const missingConsent = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, pin: '1357', returnTo, via: 'tg'
  });
  assert.equal(missingConsent.status, 400);
  const missingPin = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, consent: true, returnTo, via: 'tg'
  });
  assert.equal(missingPin.status, 400);
  const unsafeReturn = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, pin: '1357', consent: true,
    returnTo: 'https://evil.example/collect', via: 'tg'
  });
  assert.equal(unsafeReturn.status, 400);
  const requested = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, pin: '1357', consent: true, returnTo, src: 'qr', via: 'tg'
  });
  assert.equal(requested.status, 200, JSON.stringify(requested.json));
  assert.match(requested.json.pollToken || '', /^[a-f0-9]{64}$/);
  assert.match(requested.json.tgUrl || '', /^https:\/\/t\.me\/test_bot\?start=reg_[a-f0-9]{32}$/);
  assert.ok(requested.json.expiresAt);

  const throttled = await api('/api/auth/request-reg-otp', {
    name: 'Telegram Poll Guest', phone, pin: '1357', consent: true, returnTo, via: 'tg'
  });
  assert.equal(throttled.status, 429);

  const botToken = new URL(requested.json.tgUrl).searchParams.get('start')?.replace(/^reg_/, '');
  assert.ok(botToken);

  const chatId = 900000112;
  const started = await webhook({
    message: { chat: { id: chatId, type: 'private' }, from: { id: chatId }, text: '/start reg_' + botToken }
  });
  assert.equal(started.status, 200, JSON.stringify(started.json));

  const confirmed = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Telegram Poll Guest' },
      contact: { phone_number: phone, user_id: chatId }
    }
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.json));

  // The real Telegram confirmation must describe the persisted grant and both brand benefits.
  const registrationMessage = await waitForTelegramMessage(message => (
    String(message.chat_id) === String(chatId) && /Профиль готов,/.test(message.text || '')
  ));
  assert.match(registrationMessage.text, /🎁 Приветственный бонус начислен:/);
  assert.match(registrationMessage.text, /Карта: <b>0\/10<\/b> штампов/);
  assert.match(registrationMessage.text, /бесплатных кофе: <b>1<\/b>/);
  assert.match(registrationMessage.text, /Персональная бесплатная первая доставка доступна/);
  assert.match(registrationMessage.text, /подставит его автоматически/);
  const registrationReturnButton = registrationMessage.reply_markup?.inline_keyboard?.[0]?.[0];
  assert.equal(registrationReturnButton?.text, 'Вернуться в приложение');
  const registrationReturnUrl = new URL(registrationReturnButton.url);
  assert.equal(registrationReturnUrl.origin, 'https://friday.andcoffee.online');
  assert.equal(registrationReturnUrl.searchParams.get('brand'), 'coffee');
  assert.equal(registrationReturnUrl.searchParams.get('tab'), 'profile');

  const returningStart = await webhook({
    message: { chat: { id: chatId, type: 'private' }, from: { id: chatId }, text: '/start' }
  });
  assert.equal(returningStart.status, 200);
  const returningStartMessage = await waitForTelegramMessage(message => (
    String(message.chat_id) === String(chatId) && /С возвращением,/.test(message.text || '')
  ));
  assert.match(returningStartMessage.text, /Карта: <b>0\/10<\/b> штампов/);
  assert.match(returningStartMessage.text, /Персональная бесплатная первая доставка доступна/);

  const returningBonus = await webhook({
    message: { chat: { id: chatId, type: 'private' }, from: { id: chatId }, text: '/bonus' }
  });
  assert.equal(returningBonus.status, 200);
  const returningBonusMessage = await waitForTelegramMessage(message => (
    String(message.chat_id) === String(chatId) && /Ваши преимущества/.test(message.text || '')
  ));
  assert.match(returningBonusMessage.text, /Карта: <b>0\/10<\/b> штампов/);
  assert.match(returningBonusMessage.text, /бесплатных кофе: <b>1<\/b>/);
  assert.match(returningBonusMessage.text, /Персональная бесплатная первая доставка доступна/);

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
  assert.equal(validPoll.json.customer?.verified, 1);
  const completedRow = inspectDb.prepare('SELECT pin, src FROM customers WHERE phone=?').get(phone);
  assert.ok(completedRow?.pin);
  assert.equal(completedRow?.src, 'qr');
  const customerId = validPoll.json.customer.id;
  assert.deepEqual(
    inspectDb.prepare('SELECT kind FROM bonus_grants WHERE cid=?').all(customerId).map(row => row.kind),
    ['qr']
  );
  assert.equal(inspectDb.prepare('SELECT free FROM customers WHERE id=?').get(customerId).free, 1);
  assert.equal(inspectDb.prepare("SELECT COUNT(*) AS n FROM promos WHERE owner=? AND kind='freeship'").get(customerId).n, 1);

  // Telegram can redeliver a contact update; the second delivery must not grant again.
  const duplicateContact = await webhook({
    message: {
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Telegram Poll Guest' },
      contact: { phone_number: phone, user_id: chatId }
    }
  });
  assert.equal(duplicateContact.status, 200);
  assert.equal(inspectDb.prepare('SELECT COUNT(*) AS n FROM bonus_grants WHERE cid=?').get(customerId).n, 1);
  assert.equal(inspectDb.prepare("SELECT COUNT(*) AS n FROM promos WHERE owner=? AND kind='freeship'").get(customerId).n, 1);

  const replayedPoll = await api('/api/auth/check-reg', { pollToken: requested.json.pollToken });
  assert.equal(replayedPoll.status, 200);
  assert.equal(replayedPoll.json.confirmed, false);
  assert.equal(replayedPoll.json.token, undefined);
});

test('Telegram registration does not promise welcome benefits when the campaign is disabled', async () => {
  const bonusKey = "SELECT value FROM meta WHERE key='bonus_cfg'";
  const previousConfig = inspectDb.prepare(bonusKey).get();
  const disabledConfig = {
    days: 30,
    kinds: {
      signup: { coffee: 0, delivery: 0, freeFirstDelivery: 0 },
      qr: { coffee: 0, delivery: 0, freeFirstDelivery: 0 },
      install: { coffee: 0, delivery: 0, freeFirstDelivery: 0 }
    }
  };

  try {
    inspectDb.prepare(
      "INSERT INTO meta(key,value) VALUES('bonus_cfg',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(disabledConfig));

    const phone = '+7 900 000-01-18';
    const returnTo = '/?brand=delivery&tab=profile#profile';
    const requested = await api('/api/auth/request-reg-otp', {
      name: 'Telegram No Welcome Bonus',
      phone,
      pin: '1357',
      consent: true,
      returnTo,
      via: 'tg'
    });
    assert.equal(requested.status, 200, JSON.stringify(requested.json));

    const botToken = new URL(requested.json.tgUrl).searchParams.get('start')?.replace(/^reg_/, '');
    assert.match(botToken || '', /^[a-f0-9]{32}$/);
    const chatId = 900000118;
    const started = await webhook({
      message: {
        chat: { id: chatId, type: 'private' },
        from: { id: chatId, first_name: 'Telegram No Welcome Bonus' },
        text: '/start reg_' + botToken
      }
    });
    assert.equal(started.status, 200);

    const confirmed = await webhook({
      message: {
        chat: { id: chatId, type: 'private' },
        from: { id: chatId, first_name: 'Telegram No Welcome Bonus' },
        contact: { phone_number: phone, user_id: chatId }
      }
    });
    assert.equal(confirmed.status, 200);

    const registrationMessage = await waitForTelegramMessage(message => (
      String(message.chat_id) === String(chatId) && /Профиль готов,/.test(message.text || '')
    ));
    assert.match(registrationMessage.text, /Приветственный бонус сейчас не начислен: эта возможность отключена/);
    assert.match(registrationMessage.text, /Бесплатных кофе сейчас нет/);
    assert.match(registrationMessage.text, /Персонального кода бесплатной доставки сейчас нет/);
    assert.doesNotMatch(registrationMessage.text, /Персональная бесплатная первая доставка доступна/i);
    assert.doesNotMatch(registrationMessage.text, /Приветственный бонус начислен:/);

    const returnButton = registrationMessage.reply_markup?.inline_keyboard?.[0]?.[0];
    assert.equal(returnButton?.text, 'Вернуться в приложение');
    const returnedUrl = new URL(returnButton.url);
    assert.equal(returnedUrl.origin, 'https://friday.andcoffee.online');
    assert.equal(returnedUrl.searchParams.get('brand'), 'delivery');
    assert.equal(returnedUrl.searchParams.get('tab'), 'profile');
    assert.equal(returnedUrl.hash, '#profile');

    const customer = inspectDb.prepare(
      'SELECT id, verified, stamps, free FROM customers WHERE phone=?'
    ).get(phone);
    assert.equal(customer?.verified, 1);
    assert.equal(customer?.stamps, 0);
    assert.equal(customer?.free, 0);
    assert.equal(inspectDb.prepare(
      "SELECT COUNT(*) AS n FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')"
    ).get(customer.id).n, 0);
    assert.equal(inspectDb.prepare(
      "SELECT COUNT(*) AS n FROM promos WHERE owner=? AND kind='freeship'"
    ).get(customer.id).n, 0);
  } finally {
    if (previousConfig) {
      inspectDb.prepare("UPDATE meta SET value=? WHERE key='bonus_cfg'").run(previousConfig.value);
    } else {
      inspectDb.prepare("DELETE FROM meta WHERE key='bonus_cfg'").run();
    }
  }
});

test('staff role activation fails closed when role secrets are missing or weak', async () => {
  const registered = await api('/api/auth/register', {
    name: 'No Role Secret Test', phone: '+7 900 000-01-09', pin: '1234', consent: true
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.json));
  assert.ok(registered.json.token);

  const short = await api('/api/auth/activate', { code: '1234' }, registered.json.token);
  assert.equal(short.status, 400);

  const plausible = await api('/api/auth/activate', {
    code: 'ci-cashier-role-code-2026'
  }, registered.json.token);
  assert.equal(plausible.status, 403);
  assert.equal(plausible.json.customer, undefined);
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


test('profile name API enforces the published 2–24 character boundary', async () => {
  const phone = '+7 900 000-02-11';
  const registered = await api('/api/auth/register', {
    name: 'Profile Name Test', phone, pin: '1234', consent: true
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.json));
  const token = registered.json.token;

  const tooShort = await fetch(base + '/api/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ name: 'A' })
  });
  assert.equal(tooShort.status, 400);

  const tooLong = await fetch(base + '/api/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ name: 'A'.repeat(25) })
  });
  assert.equal(tooLong.status, 400);

  const minimum = await fetch(base + '/api/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ name: 'Al' })
  });
  assert.equal(minimum.status, 200);

  const maximum = await fetch(base + '/api/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ name: 'A'.repeat(24) })
  });
  assert.equal(maximum.status, 200);
  const maximumJson = await maximum.json();
  assert.equal(maximumJson.customer?.name, 'A'.repeat(24));
});

test('Web Push and FCM unregister by device and logout revokes remaining registrations', async () => {
  const phone = '+7 900 000-02-12';
  const registered = await api('/api/auth/register', {
    name: 'Push Cleanup Test', phone, pin: '1234', consent: true
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.json));
  const token = registered.json.token;
  const cid = registered.json.customer.id;

  const endpointA = 'https://push.example.invalid/subscription-a';
  const endpointB = 'https://push.example.invalid/subscription-b';
  const endpointC = 'https://push.example.invalid/subscription-c';
  const sub = endpoint => ({ endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } });

  for (const [endpoint, device] of [[endpointA, 'device-a'], [endpointB, 'device-b'], [endpointC, 'device-c']]) {
    assert.equal((await api('/api/push/subscribe', { sub: sub(endpoint), dev: device }, token)).status, 200);
  }
  for (const fcmToken of ['fcm-token-a', 'fcm-token-b', 'fcm-token-c']) {
    assert.equal((await api('/api/push/fcm', { token: fcmToken }, token)).status, 200);
  }

  const partial = await api('/api/push/unsubscribe', {
    endpoint: endpointA,
    token: 'fcm-token-a'
  }, token);
  assert.equal(partial.status, 200);
  assert.deepEqual(
    inspectDb.prepare('SELECT sub FROM subs WHERE cid=? ORDER BY sub').all(cid).map(row => JSON.parse(row.sub).endpoint),
    [endpointB, endpointC]
  );
  assert.deepEqual(
    inspectDb.prepare('SELECT token FROM fcm WHERE cid=? ORDER BY token').all(cid).map(row => row.token),
    ['fcm-token-b', 'fcm-token-c']
  );

  const emptyUnsubscribe = await api('/api/push/unsubscribe', {}, token);
  assert.equal(emptyUnsubscribe.status, 400);
  assert.deepEqual(
    inspectDb.prepare('SELECT token FROM fcm WHERE cid=? ORDER BY token').all(cid).map(row => row.token),
    ['fcm-token-b', 'fcm-token-c']
  );

  // Logging out of device B must not disconnect the still-active device C.
  const exited = await api('/api/exit', { endpoint: endpointB, token: 'fcm-token-b' }, token);
  assert.equal(exited.status, 200);
  assert.deepEqual(
    inspectDb.prepare('SELECT sub FROM subs WHERE cid=?').all(cid).map(row => JSON.parse(row.sub).endpoint),
    [endpointC]
  );
  assert.deepEqual(
    inspectDb.prepare('SELECT token FROM fcm WHERE cid=?').all(cid).map(row => row.token),
    ['fcm-token-c']
  );
  assert.equal(inspectDb.prepare('SELECT COUNT(*) AS n FROM tokens WHERE token=?').get(token).n, 0);
});


test('push test reports missing device delivery and marks smoke bypass as skipped', async () => {
  const registered = await api('/api/auth/register', {
    name: 'Push Delivery Test', phone: '+7 900 000-02-17', pin: '1234', consent: true
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.json));

  const noDevice = await api('/api/push/test', {}, registered.json.token);
  assert.equal(noDevice.status, 503, JSON.stringify(noDevice.json));
  assert.equal(noDevice.json.ok, false);
  assert.equal(noDevice.json.reason, 'no_device_delivery');
  assert.equal(noDevice.json.web?.reason, 'no_subscription');
  assert.equal(noDevice.json.fcm?.reason, 'not_delivered');

  const smoke = await fetch(base + '/api/push/test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + registered.json.token,
      'x-smoke-test': '1'
    },
    body: '{}'
  });
  assert.equal(smoke.status, 200);
  assert.deepEqual(await smoke.json(), { ok: false, skipped: 'smoke-test' });
});

test('FCM token registration transfers ownership when the same device signs into another account', async () => {
  const first = await api('/api/auth/register', {
    name: 'FCM First Owner', phone: '+7 900 000-02-15', pin: '1234', consent: true
  });
  const second = await api('/api/auth/register', {
    name: 'FCM Second Owner', phone: '+7 900 000-02-16', pin: '1234', consent: true
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(second.status, 200, JSON.stringify(second.json));

  const firstId = first.json.customer.id;
  const secondId = second.json.customer.id;
  const sharedToken = 'fcm-token-device-transfer';

  assert.equal((await api('/api/push/fcm', { token: sharedToken }, first.json.token)).status, 200);
  assert.deepEqual(
    inspectDb.prepare('SELECT cid FROM fcm WHERE token=?').get(sharedToken),
    { cid: firstId }
  );

  assert.equal((await api('/api/push/fcm', { token: sharedToken }, second.json.token)).status, 200);
  assert.deepEqual(
    inspectDb.prepare('SELECT cid FROM fcm WHERE token=?').get(sharedToken),
    { cid: secondId }
  );
  assert.equal(inspectDb.prepare('SELECT COUNT(*) AS n FROM fcm WHERE cid=?').get(firstId).n, 0);
  assert.equal(inspectDb.prepare('SELECT COUNT(*) AS n FROM fcm WHERE cid=?').get(secondId).n, 1);
});


test('stamp promo applies one batch grant and creates one history entry', async () => {
  const adminPhone = '+7 900 000-02-13';
  const adminRegistration = await api('/api/auth/register', {
    name: 'Promo Test Admin', phone: adminPhone, pin: '1357', consent: true
  });
  assert.equal(adminRegistration.status, 200, JSON.stringify(adminRegistration.json));
  const adminToken = adminRegistration.json.token;
  const activated = await api('/api/auth/activate', { code: 'integration-test-admin' }, adminToken);
  assert.equal(activated.status, 200, JSON.stringify(activated.json));

  const guestPhone = '+7 900 000-02-14';
  const created = await api('/api/staff/customers', {
    name: 'Promo Batch Guest', phone: guestPhone, pin: '4321'
  }, adminToken);
  assert.equal(created.status, 200, JSON.stringify(created.json));
  const guestLogin = await api('/api/auth/login', { phone: guestPhone, pin: '4321' });
  assert.equal(guestLogin.status, 200, JSON.stringify(guestLogin.json));
  const guestToken = guestLogin.json.token;
  const guestId = guestLogin.json.customer.id;

  const promo = await api('/api/promos', {
    code: 'BATCH-STAMP-5',
    kind: 'stamp',
    value: 5,
    maxuses: 1
  }, adminToken);
  assert.equal(promo.status, 200, JSON.stringify(promo.json));

  const redeemed = await api('/api/promo/redeem', { code: 'BATCH-STAMP-5' }, guestToken);
  assert.equal(redeemed.status, 200, JSON.stringify(redeemed.json));
  assert.equal(redeemed.json.customer.stamps, 5);
  assert.equal(redeemed.json.customer.cups, 0);
  assert.equal(
    inspectDb.prepare("SELECT COUNT(*) AS n FROM history WHERE cid=? AND a LIKE 'Начислено 5 шт.%'").get(guestId).n,
    1
  );

  const replay = await api('/api/promo/redeem', { code: 'BATCH-STAMP-5' }, guestToken);
  assert.equal(replay.status, 409);
  const current = inspectDb.prepare('SELECT stamps,cups FROM customers WHERE id=?').get(guestId);
  assert.equal(current.stamps, 5);
  assert.equal(current.cups, 0);
});


test('cashier exact-customer lookup returns current gift state and redemption is single-use', async () => {
  const adminRegistration = await api('/api/auth/register', {
    name: 'Cashier Freshness Admin',
    phone: '+7 900 000-02-18',
    pin: '1357',
    consent: true
  });
  assert.equal(adminRegistration.status, 200, JSON.stringify(adminRegistration.json));
  const adminToken = adminRegistration.json.token;
  const activated = await api('/api/auth/activate', {
    code: 'integration-test-admin'
  }, adminToken);
  assert.equal(activated.status, 200, JSON.stringify(activated.json));

  const guestRegistration = await api('/api/auth/register', {
    name: 'Cashier Freshness Guest',
    phone: '+7 900 000-02-19',
    pin: '2468',
    consent: true
  });
  assert.equal(guestRegistration.status, 200, JSON.stringify(guestRegistration.json));
  const customerId = guestRegistration.json.customer.id;
  inspectDb.prepare('UPDATE customers SET free=1 WHERE id=?').run(customerId);

  const lookupPath = '/api/staff/customers/' + encodeURIComponent(customerId);
  const anonymousLookup = await fetch(base + lookupPath);
  assert.equal(anonymousLookup.status, 401);

  const beforeRedeem = await fetch(base + lookupPath, {
    headers: { authorization: 'Bearer ' + adminToken }
  });
  assert.equal(beforeRedeem.status, 200);
  const beforeCustomer = await beforeRedeem.json();
  assert.equal(beforeCustomer.customer.id, customerId);
  assert.equal(beforeCustomer.customer.free, 1);

  const attempts = await Promise.all([
    api('/api/staff/redeem', { id: customerId, item: 'Латте' }, adminToken),
    api('/api/staff/redeem', { id: customerId, item: 'Латте' }, adminToken)
  ]);
  assert.deepEqual(attempts.map(result => result.status).sort(), [200, 400]);

  const afterRedeem = await fetch(base + lookupPath, {
    headers: { authorization: 'Bearer ' + adminToken }
  });
  assert.equal(afterRedeem.status, 200);
  const afterCustomer = (await afterRedeem.json()).customer;
  assert.equal(afterCustomer.free, 0);
  assert.equal(
    afterCustomer.history.filter(entry => entry.a.includes('Списан бесплатный кофе: Латте')).length,
    1
  );

  const missing = await fetch(base + '/api/staff/customers/missing-customer-id', {
    headers: { authorization: 'Bearer ' + adminToken }
  });
  assert.equal(missing.status, 404);
});


test('cashier customer lookup matches full Russian phone in formatted and canonical forms', async () => {
  const admin = await api('/api/auth/register', {
    name: 'Phone Search Admin',
    phone: '+7 900 000-02-20',
    pin: '1357',
    consent: true
  });
  assert.equal(admin.status, 200, JSON.stringify(admin.json));
  const activated = await api('/api/auth/activate', {
    code: 'integration-test-admin'
  }, admin.json.token);
  assert.equal(activated.status, 200, JSON.stringify(activated.json));

  const guest = await api('/api/auth/register', {
    name: 'Phone Search Anna',
    phone: '+7 911 854-30-45',
    pin: '2468',
    consent: true
  });
  assert.equal(guest.status, 200, JSON.stringify(guest.json));
  const id = guest.json.customer.id;

  for (const query of ['9118543045', '+7 911 854-30-45', '8 911 854-30-45']) {
    const response = await fetch(base + '/api/staff/customers?search=' + encodeURIComponent(query), {
      headers: { authorization: 'Bearer ' + admin.json.token }
    });
    assert.equal(response.status, 200, query);
    const result = await response.json();
    assert.deepEqual(result.customers.map(customer => customer.id), [id], query);
  }
});
