import express from 'express';
import { db } from '../db/connection.js';
import { cust, addHist, logEv } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { grant, redeem } from '../domain/loyalty.js';
import { grantBonus, QR_SOURCE } from '../domain/bonuses.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { hashPin } from '../utils/security.js';

import { staffGuard } from '../middleware/auth.js';

export const staffRouter = express.Router();


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

  // A complete phone query is an identity lookup: prioritize its canonical
  // 10-digit match instead of mixing it with name substring results and the
  // generic five-result cap. Return every exact duplicate so the cashier can
  // stop on ambiguity rather than selecting an unrelated profile.
  const normalizedPhone = ph10(raw);
  if (normalizedPhone.length === 10) {
    const exactPhones = all.filter(customer => ph10(customer.phone) === normalizedPhone);
    if (exactPhones.length) {
      return res.json({ customers: exactPhones.map(cust) });
    }
  }

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

// Карточка кассира перечитывает конкретный профиль по ID, а не использует
// устаревший результат поиска или неоднозначное совпадение имени.
staffRouter.get('/api/staff/customers/:id', staffGuard, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(String(req.params.id || ''));
  return customer
    ? res.json({ customer: cust(customer) })
    : res.status(404).json({ error: 'Гость не найден' });
});

/* ── СОЗДАНИЕ / ПОВТОРНОЕ ИСПОЛЬЗОВАНИЕ ГОСТЯ ──
   Телефон сравнивается по каноническим десяти цифрам, а не по строковому
   форматированию. При неоднозначных legacy-дубликатах не выбираем профиль наугад. */
staffRouter.post('/api/staff/customers', staffGuard, (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const pin = String(req.body.pin || '').trim();
  const normalizedPhone = fmtPhone(phone);
  const phoneDigits = ph10(normalizedPhone);

  if (name.length < 2) return res.status(400).json({ error: 'Введите имя' });
  if (phoneDigits.length !== 10) return res.status(400).json({ error: 'Введите номер полностью' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });

  let outcome;
  try {
    outcome = db.transaction(() => {
      const matches = db.prepare('SELECT * FROM customers').all()
        .filter(customer => ph10(customer.phone) === phoneDigits);

      if (matches.length > 1) {
        return { conflict: true };
      }

      if (matches.length === 1) {
        const existing = matches[0];
        const wasUnverified = !existing.verified;
        const pinAlreadySet = !!existing.pin;
        db.prepare(`
          UPDATE customers
          SET verified=1,
              pin=CASE WHEN COALESCE(pin, '')='' THEN ? ELSE pin END
          WHERE id=?
        `).run(pinAlreadySet ? existing.pin : hashPin(pin), existing.id);
        if (wasUnverified) {
          addHist(existing.id, 'Профиль проверен кассиром', 'Кассир');
          logEv(existing.name, 'Проверка профиля кассиром');
        } else if (!pinAlreadySet) {
          addHist(existing.id, 'PIN задан кассиром', 'Кассир');
          logEv(existing.name, 'PIN задан кассиром');
        }
        return {
          customer: db.prepare('SELECT * FROM customers WHERE id=?').get(existing.id),
          reused: true,
          created: false,
          wasUnverified,
          pinSet: !pinAlreadySet,
          pinPreserved: pinAlreadySet
        };
      }

      const created = createCustomer(name, normalizedPhone, pin, 'Кассир');
      if (created?.err) return { error: created.err, code: created.code || 400 };
      db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(created.customer.id);
      logEv(created.customer.name, 'Создан профиль кассиром');
      return {
        customer: db.prepare('SELECT * FROM customers WHERE id=?').get(created.customer.id),
        reused: false,
        created: true,
        wasUnverified: false,
        pinSet: true,
        pinPreserved: false
      };
    }).immediate();
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Профиль с этим номером уже создаётся. Найдите гостя и повторите попытку.' });
    }
    throw error;
  }

  if (outcome.conflict) {
    return res.status(409).json({
      error: 'Найдено несколько профилей с этим номером. Нужна проверка администратором; списание и создание остановлены.'
    });
  }
  if (outcome.error) return res.status(outcome.code).json({ error: outcome.error });

  if (outcome.created || outcome.wasUnverified) {
    grantBonus(outcome.customer.id, outcome.customer.src === QR_SOURCE ? 'qr' : 'signup');
  }
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(outcome.customer.id);
  return res.json({
    customer: cust(customer),
    created: outcome.created,
    reused: outcome.reused,
    pinSet: outcome.pinSet,
    pinPreserved: outcome.pinPreserved
  });
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