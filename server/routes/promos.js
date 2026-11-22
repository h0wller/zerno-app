import { Router } from 'express';
import { db } from '../db/connection.js';
import { userGuard, adminGuard } from '../middleware/auth.js';
import { grantStamps } from '../domain/loyalty.js';
import { findFreeDeliveryCode } from '../domain/bonuses.js';
import { cust, addHist, logEv } from '../domain/helpers.js';
import { nowISO, uid } from '../utils/id-time.js';
import { sendPush } from '../services/push.js';

export const promosRouter = Router();

// ══════════════════════════════════════════════
// Промокоды: списание клиентом и проверка для доставки
// ══════════════════════════════════════════════
promosRouter.post('/api/promo/redeem', userGuard, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Введите код' });
  if (!req.user.verified) return res.status(403).json({ error: 'Промокоды открываются после активации профиля на кассе или в Telegram' });

  let result;
  try {
    result = db.transaction(() => {
      const promo = db.prepare('SELECT * FROM promos WHERE code=?').get(code);
      if (!promo || !promo.active) return { status: 404, error: 'Такого промокода нет' };
      if ((promo.scope || 'coffee') === 'delivery') return { status: 400, error: 'Этот промокод работает только в корзине доставки' };
      if (promo.expires && new Date(promo.expires) < new Date()) return { status: 410, error: 'Промокод истёк' };
      if (promo.maxuses > 0 && promo.uses >= promo.maxuses) return { status: 410, error: 'Промокод закончился' };
      if (db.prepare('SELECT 1 FROM promo_use WHERE promo=? AND cid=?').get(promo.id, req.user.id)) {
        return { status: 409, error: 'Вы уже использовали этот промокод' };
      }

      db.prepare('INSERT INTO promo_use(promo,cid,ts) VALUES(?,?,?)').run(promo.id, req.user.id, nowISO());
      db.prepare('UPDATE promos SET uses=uses+1 WHERE id=?').run(promo.id);

      let granted = null;
      const value = Math.max(1, Math.min(100, Math.floor(Number(promo.value) || 1)));
      if (promo.kind === 'stamp') {
        granted = grantStamps(req.user.id, value, 'Промокод ' + promo.code);
        if (!granted) throw new Error('Не удалось начислить штампы');
      } else {
        db.prepare('UPDATE customers SET free=free+? WHERE id=?').run(value, req.user.id);
        addHist(req.user.id, `🎁 Промокод ${promo.code}: +${value} бесплатный кофе`, 'Система');
        granted = { addedFree: value, stamps: 0 };
      }

      logEv(req.user.name, `промокод ${promo.code}`);
      return { promo, granted, value };
    }).immediate();
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Вы уже использовали этот промокод' });
    }
    throw error;
  }

  if (result.status) return res.status(result.status).json({ error: result.error });

  const message = result.promo.kind === 'stamp'
    ? `Промокод ${result.promo.code}: +${result.value} штамп(а). Сейчас ${result.granted.customer?.stamps ?? result.granted.stamps}/10.`
    : `Промокод ${result.promo.code}: +${result.value} бесплатный кофе.`;
  sendPush(req.user.id, { title: '🎁 Промокод активирован', text: message }).catch(() => {});

  res.json({
    customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)),
    msg: result.promo.kind === 'stamp' ? `Промокод дал +${result.value} штамп(а)` : 'Промокод дал бесплатный кофе'
  });
});

promosRouter.get('/api/promo/info', (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) return res.json({ ok: false, error: 'Введите код' });
  
  const p = db.prepare('SELECT * FROM promos WHERE code=?').get(code);
  if (!p || !p.active || (p.scope || 'coffee') !== 'delivery') return res.json({ ok: false, error: 'Такого кода для доставки нет' });
  if (p.expires && new Date(p.expires) < new Date()) return res.json({ ok: false, error: 'Код истёк' });
  if (p.maxuses > 0 && p.uses >= p.maxuses) return res.json({ ok: false, error: 'Код уже использован' });
  
  res.json({ ok: true, kind: p.kind, value: p.value, code: p.code });
});

// Персональный код «первая доставка бесплатно» текущего гостя: корзина применяет его автоматически.
promosRouter.get('/api/me/free-delivery', userGuard, (req, res) => {
  res.json({ code: findFreeDeliveryCode(req.user.id) });
});

// ══════════════════════════════════════════════
// CRUD промокодов (админка)
// ══════════════════════════════════════════════
promosRouter.get('/api/promos', adminGuard, (req, res) =>
  res.json({ promos: db.prepare('SELECT * FROM promos ORDER BY created DESC').all() }));

promosRouter.post('/api/promos', adminGuard, (req, res) => {
  const b = req.body;
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (code.length < 3) return res.status(400).json({ error: 'Код слишком короткий' });
  if (db.prepare('SELECT 1 FROM promos WHERE code=?').get(code)) return res.status(409).json({ error: 'Такой код уже есть' });
  
  const expires = b.days ? new Date(Date.now() + b.days * 86400000).toISOString() : null;
  const scope = (b.kind === 'percent' || b.kind === 'money') ? 'delivery' : 'coffee';
  
  db.prepare('INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope) VALUES(?,?,?,?,1,?,?,0,?,?)')
    .run(uid('pr'), code, b.kind || 'stamp', Math.max(1, +(b.value || 1)), expires, +(b.maxuses || 0), nowISO(), scope);
  res.json({ ok: true });
});

promosRouter.post('/api/promos/:id/toggle', adminGuard, (req, res) => {
  db.prepare('UPDATE promos SET active=1-active WHERE id=?').run(req.params.id); 
  res.json({ ok: true });
});

promosRouter.delete('/api/promos/:id', adminGuard, (req, res) => {
  db.prepare('DELETE FROM promos WHERE id=?').run(req.params.id); 
  res.json({ ok: true });
});