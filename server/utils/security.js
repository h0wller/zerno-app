import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { ensureAuthSecuritySchema } from '../db/schema.js';

ensureAuthSecuritySchema();

const LOCK_THRESHOLD = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_STREAK = 6;
const INACTIVE_RESET_MS = 24 * 60 * 60 * 1000;
const RETAIN_LOCK_MS = 7 * 24 * 60 * 60 * 1000;

const selectLock = db.prepare(
  'SELECT fails, streak, locked_until AS lockedUntil, updated_at AS updatedAt FROM auth_locks WHERE scope_key=?'
);
const upsertLock = db.prepare(`
  INSERT INTO auth_locks(scope_key,fails,streak,locked_until,updated_at)
  VALUES(?,?,?,?,?)
  ON CONFLICT(scope_key) DO UPDATE SET
    fails=excluded.fails,
    streak=excluded.streak,
    locked_until=excluded.locked_until,
    updated_at=excluded.updated_at
`);
const deleteLock = db.prepare('DELETE FROM auth_locks WHERE scope_key=?');

/**
 * Хеширует PIN-код с использованием SHA-256 и соли 'pin:'.
 * @param {string|number} p - PIN-код.
 * @returns {string} Hex-строка хеша.
 */
export const hashPin = (p) => crypto.createHash('sha256').update('pin:' + String(p)).digest('hex');

/**
 * Сколько секунд осталось до снятия блокировки.
 * @param {import('express').Request} req
 * @param {string} [tag='staff']
 * @param {string} [subject=''] Идентификатор пользователя или нормализованный телефон.
 */
export const lockedSeconds = (req, tag = 'staff', subject = '') => {
  const key = lockKey(req, tag, subject);
  const entry = selectLock.get(key);
  if (!entry) return 0;

  const now = Date.now();
  if (entry.lockedUntil > now) {
    return Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
  }
  if (now - entry.updatedAt > RETAIN_LOCK_MS) deleteLock.run(key);
  return 0;
};

/**
 * Сохраняет неудачную попытку в SQLite. Пять ошибок дают минутную блокировку,
 * повторные серии увеличивают её экспоненциально до 64 минут.
 * @param {import('express').Request} req
 * @param {string} [tag='staff']
 * @param {string} [subject=''] Идентификатор пользователя или нормализованный телефон.
 */
export const registerFail = (req, tag = 'staff', subject = '') => {
  const key = lockKey(req, tag, subject);
  const now = Date.now();

  const recordFailure = db.transaction(() => {
    const current = selectLock.get(key);
    const expired = current && now - current.updatedAt > INACTIVE_RESET_MS;
    const state = !current || expired
      ? { fails: 0, streak: 0, lockedUntil: 0 }
      : current;

    // Внутри активной блокировки счётчик не увеличиваем повторно.
    if (state.lockedUntil > now) return state;

    let fails = state.fails + 1;
    let streak = state.streak;
    let lockedUntil = 0;
    if (fails >= LOCK_THRESHOLD) {
      streak += 1;
      lockedUntil = now + BASE_LOCK_MS * (2 ** Math.min(streak - 1, MAX_LOCK_STREAK));
      fails = 0;
    }
    upsertLock.run(key, fails, streak, lockedUntil, now);

    // Ограничиваем срок хранения неактивных записей.
    db.prepare('DELETE FROM auth_locks WHERE updated_at < ?').run(now - RETAIN_LOCK_MS);
    return { fails, streak, lockedUntil, updatedAt: now };
  });

  return recordFailure();
};

/** Снимает блокировку конкретного IP/операции/аккаунта после успешной проверки. */
export const clearLock = (req, tag = 'staff', subject = '') => {
  return deleteLock.run(lockKey(req, tag, subject)).changes > 0;
};

/**
 * Совместимый с прежними тестами небольшой Map-like интерфейс.
 * Реальные записи находятся в SQLite, а не в памяти процесса.
 */
export const pinLocks = {
  clear() {
    db.prepare('DELETE FROM auth_locks').run();
  },
  get(key) {
    return selectLock.get(String(key));
  },
  set(key, value) {
    upsertLock.run(
      String(key),
      Number(value?.fails) || 0,
      Number(value?.streak) || 0,
      Number(value?.lockedUntil) || 0,
      Date.now()
    );
    return this;
  },
  delete(key) {
    return deleteLock.run(String(key)).changes > 0;
  }
};

/**
 * Безопасное сравнение строк с постоянным временем для значений одинаковой длины.
 */
export const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
