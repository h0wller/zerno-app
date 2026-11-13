import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
const dbPath = path.join(os.tmpdir(), `zerno-chat-security-${randomUUID()}.db`);
const staffCodes = {
  cashier: 'integration-chat-cashier-2026',
  dispatch: 'integration-chat-dispatch-2026'
};
let server;
let output = '';
let owner;
let other;
let cashier;
let dispatcher;

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
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for test server:\n${output}`);
}

async function request(route, options = {}) {
  const response = await fetch(base + route, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: 'Bearer ' + options.token } : {}),
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function seedOtp(phone) {
  const result = await request('/__test/otp', {
    method: 'POST',
    body: { key: 'reg:' + phone, code: '2468', expiresInMs: 300000 }
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
}

async function register(name, phone) {
  await seedOtp(phone);
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { name, phone, pin: '1234', code: '2468', consent: true }
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.ok(result.json.token);
  assert.ok(result.json.customer?.id);
  return result.json;
}

async function activate(account, code) {
  const result = await request('/api/auth/activate', {
    method: 'POST',
    token: account.token,
    body: { code }
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
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
      TG_WEBHOOK_SECRET: 'integration-chat-test-secret',
      ADMIN_CODE: 'integration-chat-admin-2026',
      CASHIER_CODE: staffCodes.cashier,
      DISPATCH_CODE: staffCodes.dispatch
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += `\nSpawn error: ${error.stack || error.message}`; });
  await waitForServer();

  owner = await register('Chat Owner', '+7 900 200-00-01');
  other = await register('Other Guest', '+7 900 200-00-02');
  cashier = await register('Chat Cashier', '+7 900 200-00-03');
  dispatcher = await register('Chat Dispatcher', '+7 900 200-00-04');
  await activate(cashier, staffCodes.cashier);
  await activate(dispatcher, staffCodes.dispatch);
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

test('customer chat reads and writes require the matching customer session', async () => {
  const key = owner.customer.id + ':c';
  const anonymousWrite = await request('/api/chat/send', {
    method: 'POST',
    body: { key, text: 'must not be accepted' }
  });
  assert.equal(anonymousWrite.status, 401);

  const ownerWrite = await request('/api/chat/send', {
    method: 'POST',
    token: owner.token,
    body: { key, text: 'owner message' }
  });
  assert.equal(ownerWrite.status, 200, JSON.stringify(ownerWrite.json));

  const anonymousRead = await request('/api/chat/thread?key=' + encodeURIComponent(key));
  assert.equal(anonymousRead.status, 401);

  const otherRead = await request('/api/chat/thread?key=' + encodeURIComponent(key), {
    token: other.token
  });
  assert.equal(otherRead.status, 403);

  const ownerRead = await request('/api/chat/thread?key=' + encodeURIComponent(key), {
    token: owner.token
  });
  assert.equal(ownerRead.status, 200);
  assert.ok(ownerRead.json.msgs?.some(message => message.text === 'owner message'));

  const otherWrite = await request('/api/chat/send', {
    method: 'POST',
    token: other.token,
    body: { key, text: 'cross-account message' }
  });
  assert.equal(otherWrite.status, 403);
});

test('anonymous chat requires a high-entropy capability and throttles staff push', async () => {
  const key = 'anon-' + randomBytes(32).toString('hex') + ':d';
  const write = await request('/api/chat/send', {
    method: 'POST',
    body: { key, text: 'anonymous guest message' }
  });
  assert.equal(write.status, 200, JSON.stringify(write.json));

  const leakedUrlRead = await request('/api/chat/thread?key=' + encodeURIComponent(key));
  assert.equal(leakedUrlRead.status, 401);

  const read = await request('/api/chat/thread?after=0', {
    headers: { 'x-chat-capability': key }
  });
  assert.equal(read.status, 200);
  assert.ok(read.json.msgs?.some(message => message.text === 'anonymous guest message'));

  const weakKey = await request('/api/chat/send', {
    method: 'POST',
    body: { key: 'anon-short:c', text: 'weak capability' }
  });
  assert.equal(weakKey.status, 401);

  const anonymousEscalation = await request('/api/chat/send', {
    method: 'POST',
    body: { key, text: 'notify staff', human: 1 }
  });
  assert.equal(anonymousEscalation.status, 200, JSON.stringify(anonymousEscalation.json));

  const repeatedAnonymousEscalation = await request('/api/chat/send', {
    method: 'POST',
    body: { key, text: 'notify staff again', human: 1 }
  });
  assert.equal(repeatedAnonymousEscalation.status, 429);

});

test('human escalation is rate-limited per account, even across brand threads', async () => {
  const first = await request('/api/chat/send', {
    method: 'POST',
    token: owner.token,
    body: { key: owner.customer.id + ':d', text: 'first call', human: 1 }
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));

  const repeated = await request('/api/chat/send', {
    method: 'POST',
    token: owner.token,
    body: { key: owner.customer.id + ':c', text: 'repeat call', human: 1 }
  });
  assert.equal(repeated.status, 429);
});

test('anonymous and account staff calls share a per-IP escalation cap', async () => {
  for (let index = 0; index < 3; index++) {
    const key = 'anon-' + randomBytes(32).toString('hex') + ':d';
    const result = await request('/api/chat/send', {
      method: 'POST',
      body: { key, text: 'separate anonymous support request', human: 1 }
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
  }

  const ipEscalationLimit = await request('/api/chat/send', {
    method: 'POST',
    body: {
      key: 'anon-' + randomBytes(32).toString('hex') + ':d',
      text: 'sixth support request from same IP',
      human: 1
    }
  });
  assert.equal(ipEscalationLimit.status, 429);
});

test('message volume is limited per owner, botlog is not a public write API, and staff open is context-scoped', async () => {
  const key = other.customer.id + ':c';
  let accepted = 0;
  let limited = 0;
  for (let index = 0; index < 16; index++) {
    const result = await request('/api/chat/send', {
      method: 'POST',
      token: other.token,
      body: { key, text: 'message ' + index }
    });
    if (result.status === 200) accepted++;
    if (result.status === 429) limited++;
  }
  assert.equal(accepted, 15);
  assert.equal(limited, 1);

  const botlog = await request('/api/chat/botlog', {
    method: 'POST',
    body: { key, text: 'forged bot message' }
  });
  assert.equal(botlog.status, 404);

  const coffeeKey = owner.customer.id + ':c';
  const deliveryKey = owner.customer.id + ':d';
  for (const threadKey of [coffeeKey, deliveryKey]) {
    const result = await request('/api/chat/send', {
      method: 'POST',
      token: owner.token,
      body: { key: threadKey, text: 'openable thread' }
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
  }

  const cashierDialogCrossContext = await request('/api/chat/dialog?key=' + encodeURIComponent(deliveryKey), {
    token: cashier.token
  });
  assert.equal(cashierDialogCrossContext.status, 403);

  const dispatcherDialogCrossContext = await request('/api/chat/dialog?key=' + encodeURIComponent(coffeeKey), {
    token: dispatcher.token
  });
  assert.equal(dispatcherDialogCrossContext.status, 403);

  const cashierReplyCrossContext = await request('/api/chat/reply', {
    method: 'POST',
    token: cashier.token,
    body: { key: deliveryKey, text: 'wrong brand' }
  });
  assert.equal(cashierReplyCrossContext.status, 403);

  const dispatcherCloseCrossContext = await request('/api/chat/close', {
    method: 'POST',
    token: dispatcher.token,
    body: { key: coffeeKey }
  });
  assert.equal(dispatcherCloseCrossContext.status, 403);

  const cashierCrossContext = await request('/api/chat/open', {
    method: 'POST',
    token: cashier.token,
    body: { key: deliveryKey }
  });
  assert.equal(cashierCrossContext.status, 403);

  const dispatcherCrossContext = await request('/api/chat/open', {
    method: 'POST',
    token: dispatcher.token,
    body: { key: coffeeKey }
  });
  assert.equal(dispatcherCrossContext.status, 403);

  const cashierOwnContext = await request('/api/chat/open', {
    method: 'POST',
    token: cashier.token,
    body: { key: coffeeKey }
  });
  assert.equal(cashierOwnContext.status, 200);

  const dispatcherOwnContext = await request('/api/chat/open', {
    method: 'POST',
    token: dispatcher.token,
    body: { key: deliveryKey }
  });
  assert.equal(dispatcherOwnContext.status, 200);

  const unknownThread = await request('/api/chat/open', {
    method: 'POST',
    token: dispatcher.token,
    body: { key: 'unknown-thread:d' }
  });
  assert.equal(unknownThread.status, 404);
});
