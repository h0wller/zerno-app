import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { backupDb } from '../../scripts/backup-db.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-backup-'));
}

test('backupDb writes a readable online backup', async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, 'zerno.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec("CREATE TABLE t(v TEXT); INSERT INTO t VALUES('ok')");
  db.close();

  const out = await backupDb(dbPath);
  const copy = new Database(out, { readonly: true });
  assert.equal(copy.prepare('SELECT v FROM t').get().v, 'ok');
  copy.close();
});

test('backup CLI reads DB_PATH from the application env-file', async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, 'custom-production.db');
  const db = new Database(dbPath);
  db.exec("CREATE TABLE marker(v TEXT); INSERT INTO marker VALUES('custom-db')");
  db.close();
  const envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, 'DB_PATH=' + JSON.stringify(dbPath) + '\n');
  const scriptPath = fileURLToPath(new URL('../../scripts/backup-db.mjs', import.meta.url));
  const env = { ...process.env };
  delete env.DB_PATH;

  const result = spawnSync(process.execPath, ['--env-file=' + envFile, scriptPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  });

  assert.equal(result.status, 0, result.stderr);
  const backups = fs.readdirSync(path.join(dir, 'backups'));
  assert.equal(backups.length, 1);
  const copy = new Database(path.join(dir, 'backups', backups[0]), { readonly: true });
  assert.equal(copy.prepare('SELECT v FROM marker').get().v, 'custom-db');
  copy.close();
});

test('backupDb fails on a missing database and does not create one', async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, 'zerno.db');
  await assert.rejects(backupDb(dbPath));
  assert.equal(fs.existsSync(dbPath), false);
});

test('backupDb rejects an invalid retention count', async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, 'zerno.db');
  new Database(dbPath).close();
  await assert.rejects(backupDb(dbPath, 0), /keep must be a positive integer/);
});

test('backupDb keeps only the newest copies', async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, 'zerno.db');
  new Database(dbPath).close();
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(backups);
  for (const name of ['2020-01-01', '2020-01-02', '2020-01-03']) {
    fs.writeFileSync(path.join(backups, 'zerno-' + name + '.db'), '');
  }
  await backupDb(dbPath, 2);
  const left = fs.readdirSync(backups).filter((file) => file.startsWith('zerno-') && file.endsWith('.db') && fs.statSync(path.join(backups, file)).isFile());
  assert.equal(left.length, 2);
  assert.ok(!left.includes('zerno-2020-01-01.db'));
});

test('backupDb keeps a verified backup when retention cleanup fails', async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, 'zerno.db');
  new Database(dbPath).close();
  const backupsDir = path.join(dir, 'backups');
  fs.mkdirSync(backupsDir);
  const oldBackup = path.join(backupsDir, 'zerno-2020-01-01.db');
  fs.writeFileSync(oldBackup, '');
  const staleEntry = path.join(backupsDir, 'zerno-2020-01-02.db');
  fs.symlinkSync('missing-backup-target.db', staleEntry);

  const out = await backupDb(dbPath, 1);
  assert.ok(fs.existsSync(out));
  const copy = new Database(out, { readonly: true });
  assert.equal(copy.pragma('quick_check', { simple: true }), 'ok');
  copy.close();
  assert.ok(fs.existsSync(oldBackup));
  fs.unlinkSync(staleEntry);
});
