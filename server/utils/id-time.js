import crypto from 'node:crypto';

/**
 * Возвращает текущую дату и время в формате ISO 8601.
 * @returns {string} Строка в формате ISO.
 */
export const nowISO = () => new Date().toISOString();

/**
 * Генерирует уникальный идентификатор с заданным префиксом.
 * @param {string} p - Префикс для идентификатора.
 * @returns {string} Уникальный идентификатор (префикс + 10 hex-символов).
 */
export const uid = (p) => p + crypto.randomBytes(5).toString('hex');