import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
const dbPath = path.join(os.tmpdir(), `zerno-session-api-${randomUUID()}.db`);
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
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for test server:\\n${output}`);
}

async function request(method, route, token, body) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: token } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function registerGuest() {
  const phone = `+7 900 ${String(Date.now()).slice(-3)}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  const result = await request('POST', '/api/auth/register', null, {
    name: 'Session integration test',
    phone,
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
      TG_WEBHOOK_SECRET: '',
      SMS_AUTH_ENABLED: 'false'
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

test('valid bearer token reaches /api/me and expired token receives 401', async () => {
  const profile = await registerGuest();
  const valid = await request('GET', '/api/me', `Bearer ${profile.token}`);
  assert.equal(valid.status, 200);

  const database = new Database(dbPath);
  database.prepare('UPDATE tokens SET expires_at=? WHERE token=?')
    .run(Date.now() - 1, profile.token);
  database.close();

  const expired = await request('GET', '/api/me', `Bearer ${profile.token}`);
  assert.equal(expired.status, 401);
});

test('logout revokes the exact token with a case-insensitive Bearer scheme', async () => {
  const profile = await registerGuest();
  const header = `bEaReR ${profile.token}`;
  assert.equal((await request('GET', '/api/me', header)).status, 200);
  assert.equal((await request('POST', '/api/exit', header)).status, 200);
  assert.equal((await request('GET', '/api/me', header)).status, 401);
});

test('deleting a profile revokes every session belonging to that profile', async () => {
  const profile = await registerGuest();
  const extraToken = randomUUID();
  const database = new Database(dbPath);
  database.prepare('INSERT INTO tokens(token,kind,ref,ts,expires_at) VALUES(?,?,?,?,?)')
    .run(extraToken, 'user', profile.customer.id, new Date().toISOString(), Date.now() + 60_000);
  database.close();

  const removed = await request('DELETE', '/api/me', `Bearer ${profile.token}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.json));
  assert.equal((await request('GET', '/api/me', `Bearer ${profile.token}`)).status, 401);
  assert.equal((await request('GET', '/api/me', `Bearer ${extraToken}`)).status, 401);
});
