import express from 'express';
import { db } from '../db/connection.js';
import { cust, addHist, logEv } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { grant, redeem } from '../domain/loyalty.js';
import { ph10 } from '../utils/phone.js';
import { staffGuard } from '../middleware/auth.js';

export const staffRouter = express.Router();

let demoIdx = 0;

/* ── ПОИСК ГОСТЯ ──
   Берём ВСЕХ гостей, фильтруем по имени / 10 последним цифрам телефона.
   Раньше стояло LIMIT 50 до фильтра — свежесозданные неактивированные
   гости за пределами топ-50 не находились. */
staffRouter.get('/api/staff/customers', staffGuard, (req, res) => {
  const raw = String(req.query.search || '').trim();
  const digits = String(raw).replace(/\D/g, '');
  const d10 = digits.slice(-10);
  const t = raw.toLowerCase();

  const all = db.prepare('SELECT * FROM customers').all();

  const matches = all.filter(c => {
    if (t && c.name && String(c.name).toLowerCase().includes(t)) return true;
    if (d10.length >= 3) {
      const cd = String(c.phone || '').replace(/\D/g, '');
      if (cd && (cd.slice(-10) === d10 || cd.includes(d10) || cd.includes(digits))) return true;
    }
    return false;
  }).slice(0, 5);

  res.json({ customers: matches.map(cust) });
});

/* ── СОЗДАНИЕ ГОСТЯ ──
   Если гость уже есть (createCustomer вернул err) — не отдаём 409,
   а находим его по телефону, верифицируем и возвращаем карточку. */
staffRouter.post('/api/staff/customers', staffGuard, (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();

  const r = createCustomer(name, phone);

  if (r && r.err) {
    if (r.code === 409 || /exist/i.test(r.err)) {
      const d10 = String(phone).replace(/\D/g, '').slice(-10);
      const all = db.prepare('SELECT * FROM customers').all();
      const existing = all.find(c => {
        const cd = String(c.phone || '').replace(/\D/g, '');
        return cd.slice(-10) === d10;
      });
      if (existing) {
        db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(existing.id);
        addHist(existing.id, 'Профиль верифицирован кассиром', 'Кассир');
        logEv(existing.name, 'Верификация кассиром');
        const updated = db.prepare('SELECT * FROM customers WHERE id=?').get(existing.id);
        return res.json({ customer: cust(updated) });
      }
    }
    return res.status(r.code || 400).json({ error: r.err });
  }

  db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(r.customer.id);
  addHist(r.customer.id, 'Профиль создан', 'Кассир');
  logEv(r.customer.name, 'Создан профиль');
  res.json(r);
});

staffRouter.post('/api/staff/stamp', staffGuard, (req, res) => {
  const r = grant(req.body.id, 'Кассир');
  r ? res.json(r) : res.status(404).json({ error: 'Гость не найден' });
});

staffRouter.post('/api/staff/redeem', staffGuard, (req, res) => {
  const r = redeem(req.body.id, 'Кассир', String(req.body.item || '').slice(0, 40));
  r ? res.json(r) : res.status(400).json({ error: 'Нет доступных подарков' });
});

staffRouter.post('/api/staff/scan', staffGuard, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE qr=?').get(String(req.body.code || '').trim());
  c ? res.json({ customer: cust(c) }) : res.status(404).json({ error: 'QR не найден' });
});

staffRouter.get('/api/staff/demo', staffGuard, (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at').all();
  if (!rows.length) return res.status(404).json({ error: 'Нет гостей' });
  res.json({ customer: cust(rows[demoIdx++ % rows.length]) });
});

staffRouter.get('/api/staff/log', staffGuard, (req, res) => {
  const scope = String(req.query.scope || '').toLowerCase();
  let rows = db.prepare('SELECT t,w,a FROM events ORDER BY id DESC LIMIT 200').all();
  if (scope === 'coffee') {
    const DELIV = /заказ|доставк|курьер|пицц|корзин|отмен|выполнен|адрес/i;
    const COFF  = /штамп|профиль|подарок|бесплатн|списан|списа|кофе|верифи|актив|10-й/i;
    rows = rows.filter(l => {
      const t = String(l.a || '') + ' ' + String(l.w || '');
      if (DELIV.test(t)) return false;
      return COFF.test(t);
    });
  }
  res.json({ log: rows.slice(0, 20) });
});