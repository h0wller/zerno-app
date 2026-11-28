import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-json-parser-'));
const root = path.resolve(import.meta.dirname, '../..');
let port;
let base;
let server;
let output = '';

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

async function sendRawJson(body) {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: response.status, contentType: response.headers.get('content-type'), json, text };
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
      DB_PATH: path.join(tempRoot, 'zerno.db'),
      PUBLIC_DIR: path.join(tempRoot, 'public'),
      ADMIN_CODE: 'ci-zerno-admin-code-2026',
      TELEGRAM_BOT_TOKEN: '',
      TG_WEBHOOK_SECRET: '',
      PUBLIC_URL: '',
      HOST: '',
      SMS_AUTH_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += '\\nSpawn error: ' + (error.stack || error.message); });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Test server exited: ' + output);
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for test server:\\n' + output);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 4000))]);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('malformed JSON on a regular API route returns a stable JSON error without echoing the body', async () => {
  const response = await sendRawJson('{"phone":');
  assert.equal(response.status, 400);
  assert.match(response.contentType || '', /application\\/json/i);
  assert.deepEqual(response.json, {
    error: 'Некорректный JSON',
    code: 'INVALID_JSON'
  });
  assert.equal(response.text.includes('{"phone":'), false, 'raw request content must not be reflected');
});

test('JSON over the global 10 MiB limit returns a stable JSON 413 response', async () => {
  const response = await sendRawJson(Buffer.alloc(10 * 1024 * 1024 + 1, 0x61));
  assert.equal(response.status, 413);
  assert.match(response.contentType || '', /application\\/json/i);
  assert.deepEqual(response.json, {
    error: 'Тело запроса слишком большое',
    code: 'PAYLOAD_TOO_LARGE'
  });
});
