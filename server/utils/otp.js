/**
 * Хранилище OTP-кодов и сессий регистрации (в памяти).
 * Ключ: строка (например, телефон или токен), значение — данные сессии.
 * @type {Map<string, {code?: string, expires: number, confirmed?: boolean, phone?: string}>}
 */
export const otpStore = new Map();

/** Проверяет, что OTP-состояние существует и ещё не истекло. */
export function isOtpLive(entry, now = Date.now()) {
  return !!entry && Number.isFinite(entry.expires) && now < entry.expires;
}

/**
 * Одноразово получает и удаляет OTP-состояние, только если оно актуально
 * и удовлетворяет условию проверки.
 */
export function consumeOtp(key, predicate, now = Date.now()) {
  const entry = otpStore.get(key);
  if (!isOtpLive(entry, now) || !predicate(entry)) return null;
  otpStore.delete(key);
  return entry;
}
