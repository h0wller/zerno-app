const MAX_OTP_ENTRIES = 5000;

/**
 * Хранилище краткоживущих OTP/poll-сессий.
 * Коды и pollToken остаются только в памяти; записи очищаются по expires и ограничены по размеру.
 */
class ExpiringOtpStore extends Map {
  prune(now = Date.now()) {
    for (const [key, entry] of super.entries()) {
      if (Number.isFinite(entry?.expires) && now >= entry.expires) {
        super.delete(key);
      }
    }
    while (this.size > MAX_OTP_ENTRIES) {
      const oldest = this.keys().next();
      if (oldest.done) break;
      super.delete(oldest.value);
    }
  }

  get(key) {
    this.prune();
    return super.get(key);
  }

  has(key) {
    this.prune();
    return super.has(key);
  }

  set(key, value) {
    this.prune();
    if (super.has(key)) super.delete(key);
    while (this.size >= MAX_OTP_ENTRIES) {
      const oldest = this.keys().next();
      if (oldest.done) break;
      super.delete(oldest.value);
    }
    super.set(key, value);
    return this;
  }
}

export const otpStore = new ExpiringOtpStore();

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
