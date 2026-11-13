import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { ensureAuthSecuritySchema } from '../db/schema.js';

ensureAuthSecuritySchema();

const PHONE_COOLDOWN_MS = 60 * 1000;
const PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PHONE_MAX_SENDS = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_SENDS = 30;
const RETAIN_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

const selectLimit = db.prepare(
  'SELECT sent_count AS sentCount, window_ends AS windowEnds, last_sent AS lastSent FROM auth_otp_send_limits WHERE scope_key=?'
);
const upsertLimit = db.prepare(`
  INSERT INTO auth_otp_send_limits(scope_key,sent_count,window_ends,last_sent,updated_at)
  VALUES(?,?,?,?,?)
  ON CONFLICT(scope_key) DO UPDATE SET
    sent_count=excluded.sent_count,
    window_ends=excluded.window_ends,
    last_sent=excluded.last_sent,
    updated_at=excluded.updated_at
`);

function scopeKey(kind, scope, value) {
  return crypto.createHash('sha256')
    .update(['otp-send-v1', String(kind), String(scope), String(value)].join('\0'))
    .digest('hex');
}

function remainingWindow(row, now, duration) {
  return row && row.windowEnds > now
    ? { sentCount: row.sentCount, windowEnds: row.windowEnds }
    : { sentCount: 0, windowEnds: now + duration };
}

/**
 * Атомарно резервирует бюджет отправки OTP для телефона и IP.
 * Сохраняет только хешированные scope-ключи и счётчики; OTP/телефон/IP в БД не попадают.
 *
 * Учитывается каждая инициированная отправка, даже если внешний провайдер вернул ошибку:
 * это не позволяет использовать сбой SMS/Telegram как способ обойти лимит запросов.
 */
export function recordOtpSendAttempt(kind, phone, ip, now = Date.now()) {
  const phoneKey = scopeKey(kind, 'phone', phone);
  const ipKey = scopeKey(kind, 'ip', ip || 'local');

  const reserve = db.transaction(() => {
    const phoneRow = selectLimit.get(phoneKey);
    const ipRow = selectLimit.get(ipKey);
    const phoneWindow = remainingWindow(phoneRow, now, PHONE_WINDOW_MS);
    const ipWindow = remainingWindow(ipRow, now, IP_WINDOW_MS);

    if (phoneRow && phoneRow.lastSent > 0 && now - phoneRow.lastSent < PHONE_COOLDOWN_MS) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfter: Math.max(1, Math.ceil((phoneRow.lastSent + PHONE_COOLDOWN_MS - now) / 1000))
      };
    }
    if (phoneWindow.sentCount >= PHONE_MAX_SENDS) {
      return {
        allowed: false,
        reason: 'phone_limit',
        retryAfter: Math.max(1, Math.ceil((phoneWindow.windowEnds - now) / 1000))
      };
    }
    if (ipWindow.sentCount >= IP_MAX_SENDS) {
      return {
        allowed: false,
        reason: 'ip_limit',
        retryAfter: Math.max(1, Math.ceil((ipWindow.windowEnds - now) / 1000))
      };
    }

    upsertLimit.run(
      phoneKey,
      phoneWindow.sentCount + 1,
      phoneWindow.windowEnds,
      now,
      now
    );
    upsertLimit.run(
      ipKey,
      ipWindow.sentCount + 1,
      ipWindow.windowEnds,
      ipRow?.lastSent || 0,
      now
    );

    // Удаляем старые неактивные scope, чтобы таблица не росла бесконечно.
    db.prepare('DELETE FROM auth_otp_send_limits WHERE updated_at < ?').run(now - RETAIN_LIMIT_MS);
    return { allowed: true };
  });

  return reserve();
}

/** Удаляет лимиты отправки; предназначено для изолированных тестов. */
export function clearOtpSendLimits() {
  db.prepare('DELETE FROM auth_otp_send_limits').run();
}
