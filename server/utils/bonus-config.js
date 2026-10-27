// server/utils/bonus-config.js
// Чистая логика настроек бонусов: нормализация ввода, слияние с сохранённым и коды. Без базы.
import crypto from 'node:crypto';

export const BONUS_KINDS = ['signup', 'qr', 'install'];

export const DEFAULT_BONUS_DAYS = 30;

export const DEFAULT_BONUS_CFG = {
  days: DEFAULT_BONUS_DAYS,
  kinds: {
    // F3.64: регистрация по умолчанию даёт 10 штампов и бесплатную первую доставку
    // (скидка промокодом равна максимальной зоне доставки — 1100 ₽, см. DELIVERY.zones).
    signup: { coffee: 10, delivery: 1100 },
    qr: { coffee: 0, delivery: 0 },
    install: { coffee: 0, delivery: 0 },
  },
};

export const LIMITS = { coffee: [0, 10], delivery: [0, 5000], days: [1, 365] };

const clampInt = (v, [min, max], fallback) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

/**
 * Приводит ввод админа к допустимым значениям. Неверные значения заменяются нулями, лишние виды отбрасываются.
 * @param {object} input - Тело запроса PUT /api/admin/bonuses.
 * @returns {{days: number, kinds: object}}
 */
export function cleanBonusConfig(input = {}) {
  const kinds = {};
  for (const k of BONUS_KINDS) {
    const src = (input.kinds && input.kinds[k]) || {};
    kinds[k] = {
      coffee: clampInt(src.coffee, LIMITS.coffee, 0),
      delivery: clampInt(src.delivery, LIMITS.delivery, 0),
    };
  }
  return { days: clampInt(input.days, LIMITS.days, DEFAULT_BONUS_DAYS), kinds };
}

/**
 * Сливает сохранённую настройку с умолчаниями, чтобы новые виды бонусов не ломались на старых данных.
 * @param {object} saved - Значение из meta.bonus_cfg (уже распарсенное), может быть пустым.
 * @returns {{days: number, kinds: object}}
 */
export function mergeBonusConfig(saved = {}) {
  const kinds = {};
  for (const k of BONUS_KINDS) {
    kinds[k] = { ...DEFAULT_BONUS_CFG.kinds[k], ...((saved.kinds || {})[k] || {}) };
  }
  const days = clampInt(saved.days, LIMITS.days, DEFAULT_BONUS_DAYS);
  return { days, kinds };
}

/**
 * Персональный промокод бонуса доставки. Короткий и случайный, без похожих символов не гарантируем.
 * @returns {string} Например, B3F9A1C2.
 */
export function makeBonusPromoCode() {
  return 'B' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
