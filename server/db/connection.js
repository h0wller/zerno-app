import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// [db-connection-esm-path-v1]
// Независимость от process.cwd(): вычисляем корень проекта от расположения connection.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const DB_PATH = process.env.DB_PATH || path.join(rootDir, 'zerno.db');

export const db = new Database(DB_PATH);

// Базовые прагмы
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');