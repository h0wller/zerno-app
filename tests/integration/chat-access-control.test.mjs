import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

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
let server;
let output = '';

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Test server exited (code=${server.exitCode}, signal=${server.signalCode ?? 'none'}):\\n${output}`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for test server:\\n${output}`);
}

async function api(method, route, { body, token, chatToken } = {}) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(chatToken ? { 'x-chat-access-token': chatToken } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json, headers: Object.fromEntries(response.headers.entries()) };
}

async function register(label, suffix) {
  const phone = `+7 900 000-03-${String(suffix).padStart(2, '0')}`;
  const result = await api('POST', '/api/auth/register', {
    body: { name: label, phone, pin: '2468', consent: true }
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
      TG_WEBHOOK_SECRET: '',
      SMS_AUTH_ENABLED: 'false',
      ADMIN_CODE: 'integration-chat-admin-secret-2026',
      CASHIER_CODE: 'integration-chat-cashier-secret-2026',
      DISPATCH_CODE: 'integration-chat-dispatch-secret-2026'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += `\\nSpawn error: ${error.stack || error.message}`; });
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

test('a customer can only read and write their own brand-scoped conversation', async () => {
  const owner = await register('Chat Owner', 31);
  const other = await register('Other Customer', 32);
  const key = owner.customer.id + ':c';

  const sent = await api('POST', '/api/chat/send', {
    token: owner.token,
    body: { key, text: 'Private coffee conversation', human: 0, ctx: 'coffee' }
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.json));

  const ownHistory = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), {
    token: owner.token
  });
  assert.equal(ownHistory.status, 200);
  assert.ok(ownHistory.json.msgs.some(message => message.text === 'Private coffee conversation'));

  const anonymousRead = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key));
  assert.equal(anonymousRead.status, 401);

  const foreignRead = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), {
    token: other.token
  });
  assert.equal(foreignRead.status, 403);

  const foreignWrite = await api('POST', '/api/chat/send', {
    token: other.token,
    body: { key, text: 'Forged message', human: 0, ctx: 'coffee' }
  });
  assert.equal(foreignWrite.status, 403);

  const foreignBotLog = await api('POST', '/api/chat/botlog', {
    token: other.token,
    body: { key, text: 'Forged bot reply' }
  });
  assert.equal(foreignBotLog.status, 403);
});

test('anonymous conversation requires a high-entropy capability and does not permit staff-call spoofing', async () => {
  const key = 'anon-' + randomBytes(32).toString('hex') + ':d';
  const chatToken = randomBytes(32).toString('hex');

  const missingCapability = await api('POST', '/api/chat/send', {
    body: { key, text: 'No capability', human: 0, ctx: 'delivery' }
  });
  assert.equal(missingCapability.status, 401);

  const sent = await api('POST', '/api/chat/send', {
    chatToken,
    body: { key, text: 'Anonymous delivery question', human: 0, ctx: 'delivery' }
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.json));

  const noTokenRead = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key));
  assert.equal(noTokenRead.status, 401);

  const unknownKey = 'anon-' + randomBytes(32).toString('hex') + ':d';
  const unknownThreadRead = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(unknownKey));
  assert.equal(unknownThreadRead.status, 401, 'Unauthenticated callers must not be able to distinguish existing and unknown thread keys');

  const wrongCapability = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), {
    chatToken: randomBytes(32).toString('hex')
  });
  assert.equal(wrongCapability.status, 403);

  const history = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), { chatToken });
  assert.equal(history.status, 200);
  assert.ok(history.json.msgs.some(message => message.text === 'Anonymous delivery question'));

  const forgedHumanCall = await api('POST', '/api/chat/send', {
    chatToken,
    body: { key, text: 'Notify staff without a profile', human: 1, ctx: 'delivery' }
  });
  assert.equal(forgedHumanCall.status, 403);

  const forgedBotLog = await api('POST', '/api/chat/botlog', {
    chatToken: randomBytes(32).toString('hex'),
    body: { key, text: 'Forged bot message' }
  });
  assert.equal(forgedBotLog.status, 403);

  const legacyWeakKey = await api('GET', '/api/chat/thread?key=' + encodeURIComponent('anon-12345678:d'), {
    chatToken
  });
  assert.equal(legacyWeakKey.status, 400);
});

test('anonymous capability claims are exclusive under concurrent first use', async () => {
  const key = 'anon-' + randomBytes(32).toString('hex') + ':c';
  const firstToken = randomBytes(32).toString('hex');
  const secondToken = randomBytes(32).toString('hex');

  const results = await Promise.all([
    api('POST', '/api/chat/send', {
      chatToken: firstToken,
      body: { key, text: 'First claimant', human: 0, ctx: 'coffee' }
    }),
    api('POST', '/api/chat/send', {
      chatToken: secondToken,
      body: { key, text: 'Second claimant', human: 0, ctx: 'coffee' }
    })
  ]);

  assert.deepEqual(results.map(result => result.status).sort(), [200, 403]);
  const winner = results[0].status === 200 ? firstToken : secondToken;
  const loser = winner === firstToken ? secondToken : firstToken;
  const history = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), { chatToken: winner });
  assert.equal(history.status, 200);
  const rejected = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), { chatToken: loser });
  assert.equal(rejected.status, 403);
});

test('chat polling enforces per-thread limits and returns Retry-After', async () => {
  const key = 'anon-' + randomBytes(32).toString('hex') + ':c';
  const chatToken = randomBytes(32).toString('hex');
  const seeded = await api('POST', '/api/chat/send', {
    chatToken,
    body: { key, text: 'Seed rate-limit thread', human: 0, ctx: 'coffee' }
  });
  assert.equal(seeded.status, 200);

  let limited = null;
  for (let i = 0; i < 61; i++) {
    const response = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key), { chatToken });
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  assert.ok(limited, 'polling beyond the per-thread limit must be rate limited');
  assert.ok(Number(limited.headers['retry-after']) > 0);
});

test('chat request validation rejects oversized messages and invalid poll cursors', async () => {
  const owner = await register('Chat Validation', 33);
  const key = owner.customer.id + ':c';

  const oversized = await api('POST', '/api/chat/send', {
    token: owner.token,
    body: { key, text: 'x'.repeat(2001), human: 0, ctx: 'coffee' }
  });
  assert.equal(oversized.status, 400);

  const created = await api('POST', '/api/chat/send', {
    token: owner.token,
    body: { key, text: 'Valid thread seed', human: 0, ctx: 'coffee' }
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));

  const invalidCursor = await api('GET', '/api/chat/thread?key=' + encodeURIComponent(key) + '&after=-1', {
    token: owner.token
  });
  assert.equal(invalidCursor.status, 400);
});

test('deleting a customer removes both brand-specific chat histories', async () => {
  const owner = await register('Chat Delete', 34);
  const coffeeKey = owner.customer.id + ':c';
  const deliveryKey = owner.customer.id + ':d';

  for (const [key, ctx] of [[coffeeKey, 'coffee'], [deliveryKey, 'delivery']]) {
    const sent = await api('POST', '/api/chat/send', {
      token: owner.token,
      body: { key, text: 'Conversation to erase', human: 0, ctx }
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.json));
  }

  const deleted = await api('DELETE', '/api/me', { token: owner.token });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.json));

  const db = new Database(dbPath, { readonly: true });
  try {
    const messages = db.prepare('SELECT COUNT(*) AS count FROM chat WHERE key IN (?, ?)').get(coffeeKey, deliveryKey);
    const metadata = db.prepare('SELECT COUNT(*) AS count FROM chat_meta WHERE key IN (?, ?)').get(coffeeKey, deliveryKey);
    assert.equal(messages.count, 0);
    assert.equal(metadata.count, 0);
  } finally {
    db.close();
  }
});
