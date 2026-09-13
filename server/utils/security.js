import crypto from 'node:crypto';

/**
 * Хеширует PIN-код с использованием SHA-256 и соли 'pin:'.
 * @param {string|number} p - PIN-код.
 * @returns {string} Hex-строка хеша.
 */
export const hashPin = (p) => crypto.createHash('sha256').update('pin:' + String(p)).digest('hex');

/**
 * Внутреннее хранилище блокировок (in-memory).
 * @type {Map<string, {fails: number, streak: number, lockedUntil: number}>}
 */
export const pinLocks = new Map();

/**
 * Генерирует ключ блокировки на основе IP и тега.
 * @param {import('express').Request} req - Объект запроса Express.
 * @param {string} [tag='staff'] - Тег действия (например, 'staff', 'reg').
 * @returns {string} Ключ для хранения в Map блокировок.
 */
export const lockKey = (req, tag = 'staff') => (req.headers['x-forwarded-for'] || req.ip || 'local') + ':' + tag;

/**
 * Проверяет, сколько секунд осталось до снятия блокировки.
 * @param {import('express').Request} req - Объект запроса Express.
 * @param {string} [tag='staff'] - Тег действия.
 * @returns {number} Количество секунд блокировки (0, если не заблокировано).
 */
export const lockedSeconds = (req, tag = 'staff') => {
  const e = pinLocks.get(lockKey(req, tag));
  return e && e.lockedUntil > Date.now() ? Math.ceil((e.lockedUntil - Date.now()) / 1000) : 0;
};

/**
 * Регистрирует неудачную попытку и применяет экспоненциальную задержку.
 * @param {import('express').Request} req - Объект запроса Express.
 * @param {string} [tag='staff'] - Тег действия.
 */
export const registerFail = (req, tag = 'staff') => {
  const k = lockKey(req, tag);
  const e = pinLocks.get(k) || { fails: 0, streak: 0, lockedUntil: 0 };
  e.fails++;
  if (e.fails >= 5) {
    e.streak++;
    e.lockedUntil = Date.now() + 60000 * Math.pow(2, Math.min(e.streak - 1, 6));
    e.fails = 0;
  }
  pinLocks.set(k, e);
};

/**
 * Безопасное сравнение двух строк (защита от timing attack).
 * @param {string|number} a - Первое значение.
 * @param {string|number} b - Второе значение.
 * @returns {boolean} true, если значения совпадают.
 */
export const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};