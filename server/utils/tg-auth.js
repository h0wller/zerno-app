// server/utils/tg-auth.js
// Проверка подписи Telegram Mini App (initData) по официальному алгоритму.
// Чистый модуль без базы: его можно тестировать отдельно.
import crypto from 'node:crypto';

/** Максимальный возраст initData, секунд (один час). */
export const TG_INITDATA_MAX_AGE = 3600;

/**
 * Проверяет подпись initData и возвращает пользователя.
 * Срок годности НЕ проверяет: это делает isTgAuthFresh, чтобы решение о сроке было видно в маршруте.
 * @param {string} initData - Строка initData из Telegram WebApp.
 * @param {string} botToken - Токен бота, которым подписаны данные.
 * @returns {{user: object, authDate: number} | null}
 */
export function validateTgInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const entries = Array.from(params.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuf = Buffer.from(hash, 'hex');
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
      return null;
    }

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    const authDate = Number(params.get('auth_date') || 0);

    return { user, authDate };
  } catch (e) {
    return null;
  }
}

/**
 * Свежесть initData: auth_date не старше maxAge секунд и не из будущего дальше минуты.
 * @param {number} authDate - auth_date из initData (unix, секунды).
 * @param {number} [nowSec] - Текущее время в секундах (для тестов).
 * @param {number} [maxAge] - Максимальный возраст, секунд.
 * @returns {boolean}
 */
export function isTgAuthFresh(authDate, nowSec = Math.floor(Date.now() / 1000), maxAge = TG_INITDATA_MAX_AGE) {
  if (!authDate || !Number.isFinite(authDate)) return false;
  const age = nowSec - authDate;
  return age <= maxAge && age >= -60;
}
