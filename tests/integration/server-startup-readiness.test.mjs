import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-startup-readiness-'));
const dbPath = path.join(tempRoot, 'zerno.db');
const publicDir = path.join(tempRoot, 'public');
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

before(async () => {
  fs.mkdirSync(publicDir, { recursive: true });
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_PATH: dbPath,
    PUBLIC_DIR: publicDir,
    ADMIN_CODE: 'ci-zerno-admin-code-2026',
    TELEGRAM_BOT_TOKEN: '',
    TG_WEBHOOK_SECRET: '',
    PUBLIC_URL: '',
    HOST: '',
    SMS_AUTH_ENABLED: 'false'
  };
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { initDatabase } from './server/db/index.js';
    import { db } from './server/db/connection.js';
    initDatabase();
    db.prepare("UPDATE menu SET img=? WHERE id='esp'").run('data:image/png;base64,Zm9v');
    db.close();
  `], { cwd: root, env, stdio: 'pipe' });

  port = await reservePort();
  base = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('error', error => { output += '\\nSpawn error: ' + (error.stack || error.message); });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Test server exited: ' + output);
    if (output.includes('[migrate] Ошибка миграции изображений:')) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the deliberately invalid image migration to fail:\\n' + output);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 4000))]);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('liveness remains available but readiness fails when startup migration fails', async () => {
  const liveness = await fetch(base + '/api/health');
  assert.equal(liveness.status, 200);
  assert.deepEqual(await liveness.json(), { ok: true });

  const readiness = await fetch(base + '/api/ready');
  assert.equal(readiness.status, 503);
  assert.deepEqual(await readiness.json(), { ok: false });
  assert.equal(readiness.headers.get('retry-after'), '2');
});

test('API requests stay gated when startup migration has failed', async () => {
  const response = await fetch(base + '/api/config');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(response.headers.get('retry-after'), '2');
});
