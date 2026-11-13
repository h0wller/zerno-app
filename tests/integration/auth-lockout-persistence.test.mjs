import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');

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

async function createFixture() {
  const port = await reservePort();
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    dbPath: path.join(os.tmpdir(), `zerno-auth-lockout-${randomUUID()}.db`),
    server: null,
    output: ''
  };
}

async function waitForServer(fixture) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (fixture.server.exitCode !== null) {
      throw new Error(
        `Test server exited (code=${fixture.server.exitCode}, signal=${fixture.server.signalCode ?? 'none'}):\n${fixture.output}`
      );
    }
    try {
      const response = await fetch(`${fixture.base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for test server:\n${fixture.output}`);
}

async function startServer(fixture) {
  fixture.server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(fixture.port),
      DB_PATH: fixture.dbPath,
      TELEGRAM_BOT_TOKEN: '',
      PUBLIC_URL: '',
      TG_WEBHOOK_SECRET: 'integration-lockout-secret',
      ADMIN_CODE: 'integration-lockout-admin'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  fixture.server.stdout.on('data', chunk => { fixture.output += chunk.toString(); });
  fixture.server.stderr.on('data', chunk => { fixture.output += chunk.toString(); });
  fixture.server.on('error', error => {
    fixture.output += `\nSpawn error: ${error.stack || error.message}`;
  });
  await waitForServer(fixture);
}

async function stopServer(fixture) {
  if (!fixture.server || fixture.server.exitCode !== null) return;
  const exited = once(fixture.server, 'exit');
  fixture.server.kill('SIGTERM');
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 4000))]);
}

async function cleanupFixture(fixture) {
  await stopServer(fixture);
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(fixture.dbPath + suffix); } catch {}
  }
}

async function api(fixture, route, body) {
  const response = await fetch(fixture.base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function register(fixture, name, phone) {
  const seeded = await api(fixture, '/__test/otp', {
    key: 'reg:' + phone,
    code: '2468',
    expiresInMs: 300000
  });
  assert.equal(seeded.status, 200, JSON.stringify(seeded.json));

  const result = await api(fixture, '/api/auth/register', {
    name,
    phone,
    pin: '1234',
    code: '2468',
    consent: true
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.ok(result.json.token);
  return result.json;
}

async function failFivePins(fixture, phone) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await api(fixture, '/api/auth/login', { phone, pin: '9999' });
    assert.equal(result.status, 403, JSON.stringify(result.json));
  }
}

test('PIN lockout is scoped to the phone and does not block another customer behind the same IP', async () => {
  const fixture = await createFixture();
  try {
    await startServer(fixture);
    const firstPhone = '+7 900 200-10-01';
    const secondPhone = '+7 900 200-10-02';
    await register(fixture, 'First Lock Guest', firstPhone);
    await register(fixture, 'Second Lock Guest', secondPhone);

    await failFivePins(fixture, firstPhone);

    const secondAccount = await api(fixture, '/api/auth/login', {
      phone: secondPhone,
      pin: '1234'
    });
    assert.equal(secondAccount.status, 200, JSON.stringify(secondAccount.json));
    assert.ok(secondAccount.json.token);

    const firstAccount = await api(fixture, '/api/auth/login', {
      phone: firstPhone,
      pin: '1234'
    });
    assert.equal(firstAccount.status, 429);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('PIN lockout survives an application restart against the same SQLite database', async () => {
  const fixture = await createFixture();
  try {
    await startServer(fixture);
    const phone = '+7 900 200-10-03';
    await register(fixture, 'Restart Lock Guest', phone);
    await failFivePins(fixture, phone);

    const beforeRestart = await api(fixture, '/api/auth/login', {
      phone,
      pin: '1234'
    });
    assert.equal(beforeRestart.status, 429);

    await stopServer(fixture);
    await startServer(fixture);

    const afterRestart = await api(fixture, '/api/auth/login', {
      phone,
      pin: '1234'
    });
    assert.equal(afterRestart.status, 429, JSON.stringify(afterRestart.json));
  } finally {
    await cleanupFixture(fixture);
  }
});
