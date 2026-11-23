// Online SQLite backup through better-sqlite3's supported Backup API.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

export async function backupDb(dbPath, keep = 7) {
  if (!Number.isInteger(keep) || keep < 1) throw new TypeError('keep must be a positive integer');

  const db = new Database(dbPath, { fileMustExist: true });
  try {
    const dir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, 'zerno-' + new Date().toISOString().replace(/[:.]/g, '-') + '.db');

    try {
      await db.backup(out);
    } catch (error) {
      try {
        fs.rmSync(out, { force: true });
      } catch {
        // Preserve the original backup error.
      }
      throw error;
    }

    const verification = new Database(out, { readonly: true, fileMustExist: true });
    try {
      const integrity = verification.pragma('quick_check', { simple: true });
      if (integrity !== 'ok') throw new Error('Backup integrity check failed: ' + integrity);
    } finally {
      verification.close();
    }

    try {
      const stale = fs.readdirSync(dir)
        .filter((file) => file.startsWith('zerno-') && file.endsWith('.db') && fs.statSync(path.join(dir, file)).isFile())
        .sort()
        .slice(0, -keep);
      for (const file of stale) fs.unlinkSync(path.join(dir, file));
    } catch (error) {
      console.warn('[backup-db] retention cleanup failed:', error.message);
    }
    return out;
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(import.meta.dirname, '..');
  backupDb(process.env.DB_PATH || path.join(root, 'zerno.db'))
    .then((out) => console.log('[backup-db]', out))
    .catch((error) => {
      console.error('[backup-db] failed:', error);
      process.exitCode = 1;
    });
}
