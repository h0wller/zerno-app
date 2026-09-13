import path from 'node:path';
import Database from 'better-sqlite3';

// Корневая директория (аналог того, что было в config.js)
const rootDir = process.cwd(); 
const DB_PATH = process.env.DB_PATH || path.join(rootDir, 'zerno.db');

export const db = new Database(DB_PATH);

// Базовые прагмы
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');