/**
 * Хранилище OTP-кодов и сессий регистрации (в памяти).
 * Ключ: строка (например, телефон или токен), Значение: объект с данными сессии.
 * @type {Map<string, {code?: string, expires: number, confirmed?: boolean, phone?: string}>}
 */
export const otpStore = new Map();