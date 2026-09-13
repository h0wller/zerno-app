import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db/connection.js';
export { db };

const configDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(configDir, '..');

export const PORT = process.env.PORT || 3000;
export const ADMIN_CODE = process.env.ADMIN_CODE || '1234';
export const CASHIER_CODE = process.env.CASHIER_CODE || '2468';
export const DISPATCH_CODE = process.env.DISPATCH_CODE || '5719';
export const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(rootDir, 'public');
export const WEBAPP_URL = (process.env.WEBAPP_URL || process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/+$/, '');


let fcmReady = false;

/**
 * Устанавливает флаг готовности Firebase Cloud Messaging.
 * @param {boolean} value - Новое значение флага.
 */
export const setFcmReady = (value) => {
  fcmReady = value;
};

/**
 * Возвращает текущее состояние готовности FCM.
 * @returns {boolean} true, если FCM инициализирован.
 */
export const isFcmReady = () => fcmReady;