import crypto from 'node:crypto';

/**
 * Хеширует PIN-код с использованием SHA-256 и соли 'pin:'.
 * @param {string|number} p - PIN-код.
 * @returns {string} Hex-строка хеша.
 */
export const hashPin = (p) => crypto.createHash('sha256').update('pin:' + String(p)).digest('hex');

/**
 * Безопасное сравнение строк одинаковой длины через timingSafeEqual.
 */
export const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
