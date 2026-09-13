import express from 'express';
import { db } from '../db/connection.js';
import { cust, addHist, logEv } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { grant, redeem } from '../domain/loyalty.js';
import { ph10 } from '../utils/phone.js';
import { staffGuard } from '../middleware/auth.js';

export const staffRouter = express.Router();

let demoIdx = 0;

staffRouter.get('/api/staff/customers', staffGuard, (req, res) => {
  const q = String(req.query.search || ''); const d = ph10(q); const t = q.trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC LIMIT 50').all()
    .filter(c => (d.length >= 3 && ph10(c.phone).includes(d)) || (t && c.name.toLowerCase().includes(t)))
    .slice(0, 5);
  res.json({ customers: rows.map(cust) });
});

staffRouter.post('/api/staff/customers', staffGuard, (req, res) => {
  const r = createCustomer(req.body.name || '', req.body.phone || '');
  if (r.err) return res.status(r.code).json({ error: r.err });
  db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(r.customer.id);
  addHist(r.customer.id, 'Профиль создан', 'Кассир'); logEv(r.customer.name, 'Создан профиль');
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

staffRouter.get('/api/staff/log', staffGuard, (req, res) =>
  res.json({ log: db.prepare('SELECT t,w,a FROM events ORDER BY id DESC LIMIT 20').all() }));