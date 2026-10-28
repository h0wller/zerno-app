// server/domain/bonuses.js
// Бонусы за три события, каждое отдельно для кофейни (штампы) и доставки (скидка ₽ через промокод):
//   signup  — обычная регистрация
//   qr      — регистрация по QR с постера
//   install — установка приложения на телефон
// Доставка: скидка ₽ (delivery) и/или флаг freeFirstDelivery — одноразовый код kind='freeship' (fee = 0).
// Настройки лежат в meta.bonus_cfg, по умолчанию всё выключено (0).
// Каждый вид бонуса начисляется гостю один раз (таблица bonus_grants) и только подтверждённому профилю.
import crypto from 'crypto';
import { db } from '../db/connection.js';
import { grant, grantStamps } from './loyalty.js';
import { addHist } from './helpers.js';
import { sendPush } from '../services/push.js';
import { nowISO } from '../utils/id-time.js';
import {
  BONUS_KINDS,
  cleanBonusConfig,
  mergeBonusConfig,
  makeBonusPromoCode,
} from '../utils/bonus-config.js';

export { BONUS_KINDS };
// Значение customers.src для регистрации с QR-постера (совпадает с видом бонуса 'qr').
export const QR_SOURCE = 'qr';
export const BONUS_TITLES = {
  signup: 'Регистрация',
  qr: 'Регистрация по QR',
  install: 'Установка приложения',
};

export function getBonusConfig() {
  let saved = {};
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key='bonus_cfg'").get();
    if (row) saved = JSON.parse(row.value) || {};
  } catch (_) {}
  return mergeBonusConfig(saved);
}

export function setBonusConfig(input) {
  const clean = cleanBonusConfig(input);
  db.prepare(
    "INSERT INTO meta(key,value) VALUES('bonus_cfg',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(JSON.stringify(clean));
  return clean;
}

// Начисляет бонус вида kind гостю cid. Возвращает результат или null, если начислять нечего.
export function grantBonus(cid, kind) {
  if (!BONUS_KINDS.includes(kind)) return null;
  const c = db.prepare('SELECT id, verified FROM customers WHERE id=?').get(cid);
  if (!c || !c.verified) return null;
    // Только гости получают приветственные бонусы
  if (c.role !== 'guest') return null;
  
  // Для signup/qr: только если профиль ещё не использовался
  if ((kind === 'signup' || kind === 'qr') && (c.cups > 0 || c.stamps > 0 || c.free > 0)) {
    return null;
  }
  const cfg = getBonusConfig();
  const k = cfg.kinds[kind];
  if (!k || (k.coffee <= 0 && k.delivery <= 0 && !k.freeFirstDelivery)) return null;

  // Один раз на гостя и вид бонуса.
  const ins = db.prepare('INSERT OR IGNORE INTO bonus_grants(cid,kind,ts) VALUES(?,?,?)').run(cid, kind, nowISO());
  if (ins.changes === 0) return null;

  const parts = [];
  if (k.coffee > 0) {
    grantStamps(cid, k.coffee, 'Система');for (let i = 0; i < k.coffee; i++) grant(cid, 'Система');
    parts.push(k.coffee >= 10 ? 'приветственный напиток в кофейне (10 штампов)' : `+${k.coffee} штамп(а) в кофейне`);
  }

  let code = null;
  if (k.delivery > 0) {
    code = makeBonusPromoCode();
    const expires = new Date(Date.now() + cfg.days * 86400000).toISOString();
    db.prepare(
      'INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope) VALUES(?,?,?,?,1,?,1,0,?,?)'
    ).run(crypto.randomUUID(), code, 'money', k.delivery, expires, nowISO(), 'delivery');
    parts.push(`скидка ${k.delivery} ₽ на доставку, промокод ${code} (действует ${cfg.days} дн.)`);
  }

  // Первая доставка бесплатно: одноразовый персональный промокод вида freeship (сумма заказа не меняется, fee = 0).
  let freeCode = null;
  if (k.freeFirstDelivery) {
    freeCode = makeBonusPromoCode();
    const exp = new Date(Date.now() + cfg.days * 86400000).toISOString();
    db.prepare(
      'INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope,owner) VALUES(?,?,?,?,1,?,1,0,?,?,?)'
    ).run(crypto.randomUUID(), freeCode, 'freeship', 0, exp, nowISO(), 'delivery', cid);
    parts.push(`первая доставка бесплатно (применится в корзине сама, ${cfg.days} дн.)`);
  }

  const title = BONUS_TITLES[kind];
  addHist(cid, `🎁 Бонус «${title}»: ${parts.join(', ')}`, 'Система');
  sendPush(cid, '🎁 Бонус начислен', parts.join(', ')).catch(() => {});
  return { kind, coffee: k.coffee, delivery: k.delivery, code, freeCode };
}

// Действующий персональный код «первая доставка бесплатно» гостя (или null). Клиент применяет его в корзине сам.
export function findFreeDeliveryCode(cid) {
  const r = db.prepare(
    "SELECT code FROM promos WHERE owner=? AND kind='freeship' AND active=1 AND uses<maxuses AND (expires IS NULL OR expires>?) ORDER BY created DESC LIMIT 1"
  ).get(cid, new Date().toISOString());
  return r ? r.code : null;
}
