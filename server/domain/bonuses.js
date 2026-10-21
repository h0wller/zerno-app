// server/domain/bonuses.js
// Бонусы за три события, каждое отдельно для кофейни (штампы) и доставки (скидка ₽ через промокод):
//   signup  — обычная регистрация
//   qr      — регистрация по QR с постера
//   install — установка приложения на телефон
// Настройки лежат в meta.bonus_cfg, по умолчанию всё выключено (0).
// Каждый вид бонуса начисляется гостю один раз (таблица bonus_grants) и только подтверждённому профилю.
import crypto from 'crypto';
import { db } from '../db/connection.js';
import { grant } from './loyalty.js';
import { addHist } from './helpers.js';
import { sendPush } from '../services/push.js';
import { nowISO } from '../utils/id-time.js';

export const BONUS_KINDS = ['signup', 'qr', 'install'];
// Значение customers.src для регистрации с QR-постера (совпадает с видом бонуса 'qr').
export const QR_SOURCE = 'qr';
export const BONUS_TITLES = {
  signup: 'Регистрация',
  qr: 'Регистрация по QR',
  install: 'Установка приложения',
};

const DEFAULT_CFG = {
  days: 30, // срок действия промокода доставки, дней
  kinds: {
    signup: { coffee: 0, delivery: 0 },
    qr: { coffee: 0, delivery: 0 },
    install: { coffee: 0, delivery: 0 },
  },
};

export function getBonusConfig() {
  let saved = {};
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key='bonus_cfg'").get();
    if (row) saved = JSON.parse(row.value) || {};
  } catch (_) {}
  const kinds = {};
  for (const k of BONUS_KINDS) {
    kinds[k] = { ...DEFAULT_CFG.kinds[k], ...((saved.kinds || {})[k] || {}) };
  }
  return { days: saved.days || DEFAULT_CFG.days, kinds };
}

export function setBonusConfig(input) {
  const kinds = {};
  for (const k of BONUS_KINDS) {
    const src = (input.kinds && input.kinds[k]) || {};
    kinds[k] = {
      coffee: Math.max(0, Math.min(10, parseInt(src.coffee, 10) || 0)),
      delivery: Math.max(0, Math.min(5000, parseInt(src.delivery, 10) || 0)),
    };
  }
  const clean = {
    days: Math.max(1, Math.min(365, parseInt(input.days, 10) || DEFAULT_CFG.days)),
    kinds,
  };
  db.prepare(
    "INSERT INTO meta(key,value) VALUES('bonus_cfg',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(JSON.stringify(clean));
  return clean;
}

function makePromoCode() {
  return 'B' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Начисляет бонус вида kind гостю cid. Возвращает результат или null, если начислять нечего.
export function grantBonus(cid, kind) {
  if (!BONUS_KINDS.includes(kind)) return null;
  const c = db.prepare('SELECT id, verified FROM customers WHERE id=?').get(cid);
  if (!c || !c.verified) return null;

  const cfg = getBonusConfig();
  const k = cfg.kinds[kind];
  if (!k || (k.coffee <= 0 && k.delivery <= 0)) return null;

  // Один раз на гостя и вид бонуса.
  const ins = db.prepare('INSERT OR IGNORE INTO bonus_grants(cid,kind,ts) VALUES(?,?,?)').run(cid, kind, nowISO());
  if (ins.changes === 0) return null;

  const parts = [];
  if (k.coffee > 0) {
    for (let i = 0; i < k.coffee; i++) grant(cid, 'Система');
    parts.push(`+${k.coffee} штамп(а) в кофейне`);
  }

  let code = null;
  if (k.delivery > 0) {
    code = makePromoCode();
    const expires = new Date(Date.now() + cfg.days * 86400000).toISOString();
    db.prepare(
      'INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope) VALUES(?,?,?,?,1,?,1,0,?,?)'
    ).run(crypto.randomUUID(), code, 'money', k.delivery, expires, nowISO(), 'delivery');
    parts.push(`скидка ${k.delivery} ₽ на доставку, промокод ${code} (действует ${cfg.days} дн.)`);
  }

  const title = BONUS_TITLES[kind];
  addHist(cid, `🎁 Бонус «${title}»: ${parts.join(', ')}`, 'Система');
  sendPush(cid, '🎁 Бонус начислен', parts.join(', ')).catch(() => {});
  return { kind, coffee: k.coffee, delivery: k.delivery, code };
}
