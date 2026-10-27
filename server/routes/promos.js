import { Router } from 'express';
import { db } from '../db/connection.js';
import { userGuard, adminGuard } from '../middleware/auth.js';
import { grant } from '../domain/loyalty.js';
import { cust, addHist, logEv } from '../domain/helpers.js';
import { nowISO, uid } from '../utils/id-time.js';

export const promosRouter = Router();

// ══════════════════════════════════════════════
// Промокоды: списание клиентом и проверка для доставки
// ══════════════════════════════════════════════
promosRouter.post('/api/promo/redeem', userGuard, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Введите промокод' });
  if (!req.user.verified) return res.status(403).json({ error: 'Промокоды открываются после активации профиля на кассе или в Telegram' });
  
  const p = db.prepare('SELECT * FROM promos WHERE code=?').get(code);
  if (!p || !p.active) return res.status(404).json({ error: 'Такого промокода нет' });
  if ((p.scope || 'coffee') === 'delivery') return res.status(400).json({ error: 'Этот промокод работает только в корзине доставки' });
  if (p.expires && new Date(p.expires) < new Date()) return res.status(410).json({ error: 'Промокод истёк' });
  if (p.maxuses > 0 && p.uses >= p.maxuses) return res.status(410).json({ error: 'Промокод закончился' });
  
  if (db.prepare('SELECT 1 FROM promo_use WHERE promo=? AND cid=?').get(p.id, req.user.id))
    return res.status(409).json({ error: 'Вы уже использовали этот промокод' });
    
  db.prepare('INSERT INTO promo_use(promo,cid,ts) VALUES(?,?,?)').run(p.id, req.user.id, nowISO());
  db.prepare('UPDATE promos SET uses=uses+1 WHERE id=?').run(p.id);
  
  if (p.kind === 'stamp') { 
    for (let i = 0; i < (p.value || 1); i++) grant(req.user.id, 'Промокод ' + p.code); 
  } else { 
    db.prepare('UPDATE customers SET free=free+? WHERE id=?').run(p.value || 1, req.user.id);
    addHist(req.user.id, `🎁 Промокод ${p.code}: +${p.value || 1} бесплатный кофе`, 'Система'); 
  }
  
  logEv(req.user.name, `промокод ${p.code}`);
  res.json({ 
    customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)),
    msg: p.kind === 'stamp' ? `Промокод дал +${p.value || 1} штамп(а)` : 'Промокод дал бесплатный кофе' 
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