import path from 'node:path';
import Database from 'better-sqlite3';

// [db-connection-esm-path-v1]
// Независимость от process.cwd(): вычисляем корень проекта от расположения connection.js
const rootDir = path.resolve(import.meta.dirname, '../../');
const DB_PATH = process.env.DB_PATH || path.join(rootDir, 'zerno.db');

export const db = new Database(DB_PATH);

// Базовые прагмы
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');