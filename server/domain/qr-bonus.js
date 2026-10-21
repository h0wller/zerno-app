// server/domain/qr-bonus.js
// Бонус за регистрацию по QR с постера. Сумма и включение настраиваются админом
// (meta.qr_bonus). По умолчанию выключено: пока бонус не решён, гости ничего не получают.
import { db } from '../db/connection.js';
import { grant } from './loyalty.js';
import { addHist } from './helpers.js';

export const QR_SOURCE = 'qr';
const DEFAULT_CFG = { enabled: false, stamps: 0 };

export function getQrBonus() {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key='qr_bonus'").get();
    return row ? { ...DEFAULT_CFG, ...JSON.parse(row.value) } : { ...DEFAULT_CFG };
  } catch (_) {
    return { ...DEFAULT_CFG };
  }
}

export function setQrBonus(input) {
  const clean = {
    enabled: !!input.enabled,
    stamps: Math.max(0, Math.min(10, parseInt(input.stamps, 10) || 0)),
  };
  db.prepare(
    "INSERT INTO meta(key,value) VALUES('qr_bonus',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(JSON.stringify(clean));
  return clean;
}

// Начисляет бонус один раз и только подтверждённому гостю, пришедшему по QR.
export function applyQrBonus(cid) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.src !== QR_SOURCE || c.qr_done || !c.verified) return false;
  const cfg = getQrBonus();
  if (!cfg.enabled || cfg.stamps <= 0) return false;
  db.prepare('UPDATE customers SET qr_done=1 WHERE id=?').run(cid);
  addHist(cid, `📲 Бонус за регистрацию по QR: +${cfg.stamps} штамп(а)`, 'Система');
  for (let i = 0; i < cfg.stamps; i++) grant(cid, 'Система');
  return true;
}
