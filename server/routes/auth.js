import express from 'express';
import crypto from 'crypto';
import { db } from '../db/connection.js';
import { cust, addHist, logEv, issueToken } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { grantWelcome } from '../domain/loyalty.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { lockedSeconds, registerFail, hashPin, safeEqual, pinLocks, lockKey } from '../utils/security.js';
import { otpStore } from '../utils/otp.js';
import { nowISO } from '../utils/id-time.js';
import { sendSms } from '../services/sms.js';
import { tgSend } from '../services/telegram.js';
import { sendPush } from '../services/push.js';
import { userGuard, pendingGuard } from '../middleware/auth.js';
import { TG_BOT_USERNAME, ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE } from '../config.js';

export const authRouter = express.Router();

authRouter.post('/api/auth/request-reg-otp', (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  const via = req.body.via === 'tg' ? 'tg' : 'sms';
  if (ph10(p).length < 10) return res.status(400).json({ error: 'Введите номер полностью' });
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return res.status(409).json({ error: 'Номер уже зарегистрирован — войдите' });
  const wait = lockedSeconds(req, 'reg');
  if (wait > 0) return res.status(429).json({ error: `Слишком часто. Пауза ${wait} сек.` });
  if (via === 'tg') {
    const token = crypto.randomBytes(6).toString('hex');
    otpStore.set('regtg:' + token, { phone: p, expires: Date.now() + 10 * 60 * 1000 });
    otpStore.set('reg:' + p, { code: null, confirmed: false,expires: Date.now() + 10 * 60 * 1000 });
    return res.json({ ok: true, tgUrl: `https://t.me/${TG_BOT_USERNAME}?start=reg_${token}` });
  }
  const st = otpStore.get('reg:' + p);
  if (st && Date.now() - (st.lastSent || 0) < 60000) return res.status(429).json({ error: 'Код уже отправлен — повтор через минуту' });
  if (st && st.sent >= 5) return res.status(429).json({ error: 'Слишком много отправок — попробуйте позже' });
  const code = String(Math.floor(1000 + Math.random() * 9000));
  otpStore.set('reg:' + p, { code, expires: Date.now() + 5 *60 * 1000, sent: (st ? st.sent : 0) + 1, lastSent: Date.now() });
  sendSms(p, `…и кофе 🌊 Код регистрации: ${code}`);
  res.json({ ok: true });
});

authRouter.get('/api/auth/check-reg', (req, res) => {
  const p = fmtPhone(req.query.phone || '');
  const st = otpStore.get('reg:' + p);
  res.json({ confirmed: !!(st && st.confirmed && Date.now() < st.expires) });
});

authRouter.post('/api/auth/register', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const code = String(req.body.code || '').trim();
const st = otpStore.get('reg:' + p);
const okTg = !!(st && st.confirmed && Date.now() < st.expires);
const okSms = !!(st && st.code && code && st.code === code && Date.now() < st.expires);
if (okSms) pinLocks.delete(lockKey(req, 'reg'));
const tgChat = okTg ? (st.tgChat || null) : null;
if (okTg || okSms) otpStore.delete('reg:' + p);
const ex = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (ex) {
  const age = Date.now() - new Date(ex.created_at).getTime();
  if (!ex.verified && age > 7 * 86400000) {
    db.prepare('DELETE FROM tokens WHERE ref=?').run(ex.id);
    db.prepare('DELETE FROM customers WHERE id=?').run(ex.id);
  } else if (okTg && !ex.verified) {
    db.prepare('DELETE FROM tokens WHERE ref=?').run(ex.id);
    db.prepare('UPDATE customers SET name=?, tg=?, verified=1 WHERE id=?')
      .run(String(req.body.name || '').trim() || ex.name, tgChat, ex.id);
    addHist(ex.id, 'Профиль подтверждён через Telegram', 'Система');
    grantWelcome(ex.id, 'Telegram');
    return res.json({ token: issueToken(ex.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(ex.id)) });
  } else return res.status(409).json({ error: 'exists' });
}
const r = createCustomer(req.body.name || '', req.body.phone|| '', req.body.pin || '');
if (r.err) return res.status(r.code).json({ error: r.err });
if (okTg || okSms) {
  if (tgChat) db.prepare('UPDATE customers SET tg=? WHERE id=?').run(tgChat, r.customer.id);
  db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(r.customer.id);
  if (okTg) grantWelcome(r.customer.id, 'Telegram');
  addHist(r.customer.id, okTg ? 'Telegram привязан при регистрации' : 'Подтверждение по SMS', 'Система');
  if (!req.body.consent) return res.status(400).json({ error: 'Нужно согласие с политикой конфиденциальности' });
  db.prepare('UPDATE customers SET consent=? WHERE id=?').run(nowISO() + ' v1', r.customer.id);
} else {
  let ac; do { ac = String(Math.floor(1000 + Math.random() *9000)); }
  while (db.prepare('SELECT 1 FROM customers WHERE actcode=?AND verified=0').get(ac));
  db.prepare('UPDATE customers SET actcode=? WHERE id=?').run(ac, r.customer.id);
  const staff = db.prepare("SELECT id FROM customers WHERE role IN ('cashier','admin')").all();
  for (const s of staff) sendPush(s.id, '🆕 Новый гость ждёт активации', `${r.customer.name}, ${r.customer.phone} — код ${ac}`);
  logEv(r.customer.name, 'регистрация без TG, ждёт код кассира');
}
res.json({ token: issueToken(r.customer.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(r.customer.id)) });
});

authRouter.post('/api/auth/activate-guest', userGuard, (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Код — 4 цифры' });
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id);
  if (c.verified) return res.status(409).json({ error: 'Профиль уже активирован' });
  if (!c.actcode || c.actcode !== code) { registerFail(req, 'act'); return res.status(403).json({ error: 'Неверный код активации' }); }
  db.prepare('UPDATE customers SET verified=1, actcode=NULL WHERE id=?').run(c.id);
  addHist(c.id, '✅ Профиль активирован на кассе', 'Кассир');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
});

authRouter.post('/api/auth/login', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const pin = String(req.body.pin || '').trim();
const otp = String(req.body.otp || '').trim();
const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (!c) return res.status(404).json({ error: 'Профиль не найден — создайте новый' });
const wait = lockedSeconds(req, 'login');
if (wait > 0) return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });
if (otp) {
 const st = otpStore.get(p);
 if (!st || Date.now() > st.expires) return res.status(403).json({ error: 'Код просрочен — запросите новый' });
 if (st.code !== otp) { registerFail(req, 'login'); return res.status(403).json({ error: 'Неверный код' }); }
 otpStore.delete(p); pinLocks.delete(lockKey(req, 'login'));
 addHist(c.id, 'Вход по коду из Telegram', 'Приложение');
 return res.json({ token: issueToken(c.id), customer: cust(c), needPin: !c.pin });
}
if (!c.pin) {
 if (!pin) return res.status(409).json({ error: 'PIN ещё не задан — придумайте его', setup: true });
 if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
 db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), c.id);
 addHist(c.id, 'Задан PIN (первый вход)', 'Приложение');
 return res.json({ token: issueToken(c.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
}
if (!pin) return res.status(400).json({ error: 'Введите PIN'});
if (hashPin(pin) !== c.pin) { registerFail(req, 'login'); return res.status(403).json({ error: 'Неверный PIN' }); }
pinLocks.delete(lockKey(req, 'login'));
addHist(c.id, 'Вход по PIN', 'Приложение');
res.json({ token: issueToken(c.id), customer: cust(c) });
});

authRouter.post('/api/auth/setup-pin', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const pin = String(req.body.pin || '').trim();
if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (!c) return res.status(404).json({ error: 'Профиль не найден' });
if (c.pin) return res.status(403).json({ error: 'PIN уже задан — входите с ним' });
db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), c.id);
addHist(c.id, 'Задан PIN (первый вход)', 'Приложение');
res.json({ token: issueToken(c.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
});

authRouter.post('/api/auth/set-pin', userGuard, (req, res) => {
const pin = String(req.body.pin || '').trim();
if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), req.user.id);
addHist(req.user.id, 'Задан новый PIN', 'Приложение');
res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.post('/api/auth/request-otp', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (!c) return res.status(404).json({ error: 'Профиль не найден' });
if (!c.tg) return res.status(400).json({ error: 'Telegram непривязан — войдите по PIN' });
const wait = lockedSeconds(req, 'login');
if (wait > 0) return res.status(429).json({ error: `Слишком часто. Пауза ${wait} сек.` });
const code = String(Math.floor(1000 + Math.random() * 9000));
otpStore.set(p, { code, expires: Date.now() + 5 * 60 * 1000 });
tgSend(c.tg, `🔑 Код для входа в приложение: ${code}\nДействует 5 минут. Никому не сообщайте!`);
res.json({ ok: true });
});

authRouter.post('/api/auth/activate', userGuard, (req, res) => {
  const wait = lockedSeconds(req);
  if (wait > 0) return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });
  const code = String(req.body.code || '').trim();
  let role = null;
  if (safeEqual(code, ADMIN_CODE)) role = 'admin';
  else if (safeEqual(code, CASHIER_CODE)) role = 'cashier';
  else if (safeEqual(code, DISPATCH_CODE)) role = 'dispatch';
  if (!role) { registerFail(req); return res.status(403).json({ error: 'Неверный код доступа' }); }
  pinLocks.delete(lockKey(req));
  db.prepare('UPDATE customers SET role=? WHERE id=?').run(role, req.user.id);
  addHist(req.user.id, role === 'admin' ? '🔓 Выдан доступ администратора' : '🧾 Выдан доступ кассира', 'Система');
  logEv(req.user.name, role === 'admin' ? 'активирован админ' : 'активирован кассир');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.post('/api/staff/activate-guest', pendingGuard, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(String(req.body.id || ''));
  if (!c) return res.status(404).json({ error: 'Гость не найден' });
  if (c.verified) return res.status(409).json({ error: 'Уже активирован' });
  db.prepare('UPDATE customers SET verified=1, actcode=NULL WHERE id=?').run(c.id);
  addHist(c.id, '✅ Профиль активирован сотрудником', 'Сотрудник');
  logEv(req.user.name, `активировал гостя ${c.name}`);
  res.json({ ok: true });
});

authRouter.get('/api/staff/pending', pendingGuard, (req, res) => {
  res.json({ pending: db.prepare('SELECT id,name,phone,actcode,created_at FROM customers WHERE verified=0 AND actcode IS NOT NULL ORDER BY created_at DESC LIMIT 20').all() });
});

authRouter.post('/api/auth/deactivate', userGuard, (req, res) => {
  if (req.user.role === 'admin') {
    const n = db.prepare("SELECT COUNT(*) as c FROM customers WHERE role='admin'").get().c;
    if (n <= 1) return res.status(403).json({ error: 'Нельзя отключить последнего администратора' });
  }
  db.prepare("UPDATE customers SET role='guest' WHERE id=?").run(req.user.id);
  addHist(req.user.id, 'Права сотрудника отключены', 'Система');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.post('/api/exit', userGuard, (req, res) => {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  db.prepare('DELETE FROM tokens WHERE token=?').run(t); res.json({ ok: true });
});

authRouter.get('/api/me', userGuard, (req, res) => res.json({ customer: cust(req.user) }));

authRouter.put('/api/me', userGuard, (req, res) => {
  const name = String(req.body.name || '').trim() || 'Гость';
  db.prepare('UPDATE customers SET name=? WHERE id=?').run(name, req.user.id);
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.put('/api/me/notify', userGuard, (req, res) => {
  db.prepare('UPDATE customers SET notify_tg=?, notify_web=? WHERE id=?')
    .run(req.body.tg ? 1 : 0, req.body.web ? 1 : 0, req.user.id);
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.post('/api/redeem', userGuard, (req, res) => {
  const r = redeem(req.user.id, 'Гость');
  r ? res.json(r) : res.status(400).json({ error: 'Нет доступных подарков' });
});