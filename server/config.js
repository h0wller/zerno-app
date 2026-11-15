// server/config.js — ТОЛЬКО константы окружения (Fix-env, F3.59-fix).
// Без side-effect: импорт кодов/портов не открывает SQLite.
// db берите напрямую из './db/connection.js' там, где он нужен.
import path from 'node:path';

const configDir = import.meta.dirname;
const rootDir = path.resolve(configDir, '..');

export const PORT = process.env.PORT || 3000;
export const SMS_AUTH_ENABLED = String(process.env.SMS_AUTH_ENABLED || '').toLowerCase() === 'true';
export const ADMIN_CODE = String(process.env.ADMIN_CODE || '').trim();
export const CASHIER_CODE = String(process.env.CASHIER_CODE || '').trim();
export const DISPATCH_CODE = String(process.env.DISPATCH_CODE || '').trim();
export const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(rootDir, 'public');
export const WEBAPP_URL = (process.env.WEBAPP_URL || process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/+$/, '');
export const TG_BOT_USERNAME = process.env.TG_BOT_USERNAME || 'friday_and_coffeeBot'; // ⚠️ подставь реальный username своего бота без @