import express from 'express';
import { validateTgInitData, isTgAuthFresh } from '../utils/tg-auth.js';
import crypto from 'crypto';
import { db } from '../db/connection.js';
import { cust, addHist, logEv, issueToken } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { linkTelegram } from '../domain/telegram-link.js';
import { grantWelcome, redeem } from '../domain/loyalty.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { hashPin, safeEqual } from '../utils/security.js';
import { lockedSeconds, registerFail, clearLock, getOtpSendState, recordOtpSend } from '../utils/auth-rate-limits.js';
import { otpStore, isOtpLive, consumeOtp } from '../utils/otp.js';
import { nowISO } from '../utils/id-time.js';
import { sendSms } from '../services/sms.js';
import { tgSend, TG_TOKEN } from '../services/telegram.js';
import { sendPush } from '../services/push.js';
import { userGuard, pendingGuard, adminGuard } from '../middleware/auth.js';
import { grantBonus, getBonusConfig, setBonusConfig, QR_SOURCE } from '../domain/bonuses.js';
import { validate, RegisterSchema, LoginSchema, SetupPinSchema, ActivateCodeSchema } from '../middleware/validate.js';
import { TG_BOT_USERNAME, ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE, SMS_AUTH_ENABLED } from '../config.js';

export const authRouter = express.Router();

// Isolated test seam: never registered in production.
if (process.env.NODE_ENV === 'test') {
  authRouter.post('/__test/otp', (req, res) => {
    const key = String(req.body?.key || '');
    const code = String(req.body?.code || '');
    const expiresInMs = Number(req.body?.expiresInMs);
    if ((!key.startsWith('reg:') && !/^[+0-9\s-]{10,24}$/.test(key)) || !code || !Number.isFinite(expiresInMs)) {
      return res.status(400).json({ error: 'Invalid test OTP fixture' });
    }
    otpStore.set(key, { code, expires: Date.now() + expiresInMs });
    return res.json({ ok: true });
  });
}

// [tg-link-auth-endpoint-v1]

authRouter.post('/api/auth/tg-link', (req, res) => {
  const initData = String(req.body.initData || '').trim();
  const valid = validateTgInitData(initData, TG_TOKEN);
  if (!valid || !valid.user || !valid.user.id) {
    return res.status(401).json({ error: 'Неверные данные авторизации Telegram' });
  }
  // initData подписан, но без срока годности его можно было бы повторять бесконечно. Берём окно в час.
  if (!isTgAuthFresh(valid.authDate)) {
    return res.status(401).json({ error: 'Сессия Telegram устарела, откройте приложение заново' });
  }

  const tgId = String(valid.user.id);
  const tgName = [valid.user.first_name, valid.user.last_name].filter(Boolean).join(' ') || valid.user.username || 'Гость';

  // 1. Проверяем, есть ли уже профиль с таким Telegram ID
  const linkedRows = db.prepare('SELECT id FROM customers WHERE tg=?').all(tgId);
  if (linkedRows.length > 1) {
    return res.status(409).json({ error: 'Этот Telegram привязан к нескольким профилям. Обратитесь к администратору.' });
  }
  let c = linkedRows.length === 1 ? db.prepare('SELECT * FROM customers WHERE id=?').get(linkedRows[0].id) : null;
  if (c) {
    addHist(c.id, 'Вход через Telegram Mini App', 'Telegram');
    return res.json({ token: issueToken(c.id), customer: cust(c), isNew: false });
  }

  // 2. Если профиля нет по TG — проверяем, передан ли номер
  const rawPhone = String(req.body.phone || '').trim();
  if (!rawPhone) {
    return res.json({
      needPhone: true,
      tgUser: {
        id: tgId,
        name: tgName,
        username: valid.user.username || null
      }
    });
  }

  const p = fmtPhone(rawPhone);
  if (ph10(p).length < 10) {
    return res.status(400).json({ error: 'Введите номер полностью' });
  }
  // Не полагаемся только на UI: согласие обязательно для привязки/создания профиля по номеру.
  if (req.body.consent !== 1 && req.body.consent !== true) {
    return res.status(400).json({ error: 'Нужно согласие с политикой конфиденциальности' });
  }

  // Номер не доказан: привязка и создание профиля по номеру возможны только после подтверждения контактом в боте
  // от того же Telegram-аккаунта (см. webhook: tgChat совпадает с этим tgId).
  const confirmed = otpStore.get('reg:' + p);
  const botOk = isOtpLive(confirmed) && !!confirmed.confirmed && String(confirmed.tgChat) === tgId;
  if (!botOk) {
    const botToken = crypto.randomBytes(6).toString('hex');
    otpStore.set('regtg:' + botToken, { phone: p, name: String(req.body.name || '').trim(), expires: Date.now() + 10 * 60 * 1000 });
    otpStore.set('reg:' + p, { code: null, confirmed: false, expires: Date.now() + 10 * 60 * 1000 });
    registerFail(req, 'reg-otp-send', p);
    return res.json({ needBotConfirm: true, tgUrl: `https://t.me/${TG_BOT_USERNAME}?start=reg_${botToken}` });
  }
  otpStore.delete('reg:' + p);
  clearLock(req, 'reg', p);
  clearLock(req, 'reg-otp-send', p);

  // 3. Ищем существующего клиента по номеру телефона
  c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
  if (c) {
    const linked = linkTelegram(db, c.id, tgId);
    if (!linked.ok) return res.status(409).json({ error: 'Не удалось привязать Telegram к профилю. Возможно, он уже связан с другим аккаунтом.' });
    db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(c.id);
    if (!c.welcome) {
      grantWelcome(c.id, 'Telegram');
    }
    grantBonus(c.id, c.src === QR_SOURCE ? 'qr' : 'signup');
    addHist(c.id, 'Telegram привязан через Mini App', 'Telegram');
    const updated = db.prepare('SELECT * FROM customers WHERE id=?').get(c.id);
    return res.json({ token: issueToken(c.id), customer: cust(updated), isNew: false });
  }

  // 4. Создаем нового клиента сразу верифицированным через Telegram
  const finalName = String(req.body.name || '').trim() || tgName;
  const pin = String(req.body.pin || '').trim();
  const r = createCustomer(finalName, p, pin);
  if (r.err) return res.status(r.code).json({ error: r.err });

  // F3.61: tg-link создаёт профиль только после подтверждения контакта в боте — номер доказан,
  // consent проставляется сервером. Но если клиент принёс src=QR_SOURCE (сканирование с постера),
  // источник регистрации сохраняем так же, как в /api/auth/register (иначе бонус за QR не начислится).
  if (req.body.src === QR_SOURCE) db.prepare('UPDATE customers SET src=? WHERE id=?').run(QR_SOURCE, r.customer.id);
  const linked = linkTelegram(db, r.customer.id, tgId);
  if (!linked.ok) {
    db.prepare('DELETE FROM customers WHERE id=?').run(r.customer.id);
    return res.status(409).json({ error: 'Не удалось привязать Telegram к новому профилю. Попробуйте войти снова.' });
  }
  db.prepare('UPDATE customers SET verified=1, consent=? WHERE id=?')
    .run(nowISO() + ' v1', r.customer.id);
  grantWelcome(r.customer.id, 'Telegram');
  grantBonus(r.customer.id, req.body.src === QR_SOURCE ? 'qr' : 'signup');
  addHist(r.customer.id, 'Регистрация через Telegram Mini App', 'Telegram');

  const newCust = db.prepare('SELECT * FROM customers WHERE id=?').get(r.customer.id);
  return res.json({ token: issueToken(r.customer.id), customer: cust(newCust), isNew: true });
});

authRouter.post('/api/auth/request-reg-otp', async (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  const via = req.body.via === 'sms' ? 'sms' : 'tg';
  if (ph10(p).length < 10) return res.status(400).json({ error: 'Введите номер полностью' });
  if (via === 'sms' && !SMS_AUTH_ENABLED) {
    return res.status(503).json({ error: 'Подтверждение по SMS пока отключено. Используйте Telegram или получите код активации у кассира.' });
  }
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) {
    return res.status(409).json({ error: 'Номер уже зарегистрирован — войдите' });
  }
  const wait = Math.max(lockedSeconds(req, 'reg', p), lockedSeconds(req, 'reg-otp-send', p));
  if (wait > 0) return res.status(429).json({ error: `Слишком часто. Пауза ${wait} сек.` });

  const now = Date.now();
  const sendState = getOtpSendState('register', p);
  if (sendState && now - sendState.lastSent < 60000) {
    return res.status(429).json({ error: 'Код уже отправлен — повтор через минуту' });
  }
  if (sendState && now < sendState.windowEnds && sendState.sent >= 5) {
    return res.status(429).json({ error: 'Слишком много отправок — попробуйте позже' });
  }

  if (via === 'tg') {
    const token = crypto.randomBytes(16).toString('hex');
    const pollToken = crypto.randomBytes(32).toString('hex');
    const reqName = String(req.body.name || '').trim();
    otpStore.set('regtg:' + token, {
      phone: p, name: reqName, pollToken, expires: Date.now() + 10 * 60 * 1000
    });
    otpStore.set('reg:' + p, { code: null, confirmed: false, expires: now + 10 * 60 * 1000 });
    recordOtpSend('register', p, now);
    registerFail(req, 'reg-otp-send', p);
    return res.json({
      ok: true,
      pollToken,
      tgUrl: `https://t.me/${TG_BOT_USERNAME}?start=reg_${token}`
    });
  }

  const code = String(crypto.randomInt(1000, 10000));
  const delivery = await sendSms(p, `…и кофе 🌊 Код регистрации: ${code}`);
  if (!delivery?.ok) {
    return res.status(503).json({ error: 'Не удалось отправить SMS. Попробуйте позже.' });
  }
  otpStore.set('reg:' + p, { code, via: 'sms', expires: now + 5 * 60 * 1000 });
  recordOtpSend('register', p, now);
  registerFail(req, 'reg-otp-send', p);
  res.json({ ok: true, via: 'sms' });
});

// [tg-web-seamless-auth-v1]
authRouter.post('/api/auth/check-reg', (req, res) => {
  const pollToken = String(req.body?.pollToken || '');
  if (!/^[a-f0-9]{64}$/.test(pollToken)) {
    return res.status(400).json({ error: 'Неверный ключ подтверждения регистрации' });
  }
  const st = otpStore.get('regpoll:' + pollToken);
  if (!isOtpLive(st)) {
    otpStore.delete('regpoll:' + pollToken);
    return res.json({ confirmed: false });
  }
  otpStore.delete('regpoll:' + pollToken);
  return res.json({ confirmed: true, token: st.token, customer: st.customer });
});

authRouter.post('/api/auth/register', validate(RegisterSchema), (req, res) => {
  // Проверяем согласие до любых изменений БД и до потребления OTP.
  if (req.body.consent !== 1 && req.body.consent !== true) {
    return res.status(400).json({ error: 'Нужно согласие с политикой конфиденциальности' });
  }
  const p = fmtPhone(req.body.phone || '');
  const ex = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
  if (ex) {
    const age = Date.now() - new Date(ex.created_at).getTime();
    if (!ex.verified && age > 7 * 86400000) {
      db.prepare('DELETE FROM tokens WHERE ref=?').run(ex.id);
      db.prepare('DELETE FROM customers WHERE id=?').run(ex.id);
    } else {
      return res.status(409).json({ error: 'exists' });
    }
  }

  const code = String(req.body.code || '').trim();
  const registrationWait = lockedSeconds(req, 'reg', p);
  if (registrationWait > 0) {
    return res.status(429).json({ error: `Слишком много попыток подтверждения. Пауза ${registrationWait} сек.` });
  }

  const st = otpStore.get('reg:' + p);
  const okSms = SMS_AUTH_ENABLED && isOtpLive(st) && !!st.code && !!code && st.code === code;
  if (SMS_AUTH_ENABLED && code && !okSms) {
    registerFail(req, 'reg', p);
    return res.status(403).json({ error: 'Неверный или просроченный код подтверждения' });
  }
  if (okSms) {
    clearLock(req, 'reg', p);
    clearLock(req, 'reg-otp-send', p);
    consumeOtp('reg:' + p, entry => !!entry.code && entry.code === code);
  }

  const r = createCustomer(req.body.name || '', req.body.phone || '', req.body.pin || '');
  if (r.err) return res.status(r.code).json({ error: r.err });
  // Откуда пришёл гость (сейчас только QR с постера). Бонус начисляется позже, при подтверждении.
  if (req.body.src === QR_SOURCE) db.prepare('UPDATE customers SET src=? WHERE id=?').run(QR_SOURCE, r.customer.id);

  if (okSms) {
    db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(r.customer.id);
    addHist(r.customer.id, 'Подтверждение по SMS', 'Система');
    db.prepare('UPDATE customers SET consent=? WHERE id=?').run(nowISO() + ' v1', r.customer.id);
  } else {
    let ac;
    do {
      ac = String(Math.floor(1000 + Math.random() * 9000));
    } while (db.prepare('SELECT 1 FROM customers WHERE actcode=? AND verified=0').get(ac));
    db.prepare('UPDATE customers SET actcode=? WHERE id=?').run(ac, r.customer.id);
    const staff = db.prepare("SELECT id FROM customers WHERE role IN ('cashier','admin')").all();
    for (const s of staff) {
      sendPush(s.id, '🆕 Новый гость ждёт активации', `${r.customer.name}, ${r.customer.phone} — код ${ac}`).catch(() => {});
    }
    logEv(r.customer.name, 'регистрация без TG, ждёт код кассира');
  }

  if (okSms) grantBonus(r.customer.id, req.body.src === QR_SOURCE ? 'qr' : 'signup');
  res.json({ token: issueToken(r.customer.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(r.customer.id)) });
});
authRouter.post('/api/auth/activate-guest', userGuard,(req, res) => {
  const wait = lockedSeconds(req, 'act', req.user.id);
  if (wait > 0) {
    return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });
  }
  const code = String(req.body.code || '').trim();
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Код — 4 цифры' });
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id);
  if (c.verified) return res.status(409).json({ error: 'Профиль уже активирован' });
  if (!c.actcode || c.actcode !== code) {
    registerFail(req, 'act', req.user.id);
    return res.status(403).json({ error: 'Неверный код активации' });
  }
  clearLock(req, 'act', req.user.id);
  db.prepare('UPDATE customers SET verified=1, actcode=NULL WHERE id=?').run(c.id);
  addHist(c.id, '✅ Профиль активирован на кассе', 'Кассир');
  // Приветственный бонус — как и при активации сотрудником (/api/staff/activate-guest).
  grantBonus(c.id, c.src === QR_SOURCE ? 'qr' : 'signup');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
});

authRouter.post('/api/auth/login', validate(LoginSchema), (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  const pin = String(req.body.pin || '').trim();
  const otp = String(req.body.otp || '').trim();
  const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
  if (!c) return res.status(404).json({ error: 'Профиль не найден — создайте новый' });

  const wait = lockedSeconds(req, 'login', p);
  if (wait > 0) return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });

  if (otp) {
    const st = otpStore.get(p);
    if (!isOtpLive(st)) return res.status(403).json({ error: 'Код просрочен — запросите новый' });
    if (st.via === 'sms' && !SMS_AUTH_ENABLED) {
      return res.status(503).json({ error: 'Вход по SMS отключён. Запросите новый код в Telegram.' });
    }
    if (st.code !== otp) {
      registerFail(req, 'login', p);
      return res.status(403).json({ error: 'Неверный код' });
    }
    consumeOtp(p, entry => entry.code === otp);
    clearLock(req, 'login', p);
    clearLock(req, 'otp-send', p);
    addHist(c.id, `Вход по коду из ${st.via === 'sms' ? 'SMS' : 'Telegram'}`, 'Приложение');
    return res.json({ token: issueToken(c.id), customer: cust(c), needPin: !c.pin });
  }

  if (!c.pin) {
    return res.status(409).json({
      error: 'PIN не задан. Сначала подтвердите номер кодом из Telegram или SMS.',
      setup: true
    });
  }

  if (!pin) return res.status(400).json({ error: 'Введите PIN' });
  if (hashPin(pin) !== c.pin) {
    registerFail(req, 'login', p);
    return res.status(403).json({ error: 'Неверный PIN' });
  }

  clearLock(req, 'login', p);
  addHist(c.id, 'Вход по PIN', 'Приложение');
  res.json({ token: issueToken(c.id), customer: cust(c) });
});

authRouter.post('/api/auth/setup-pin', userGuard, validate(SetupPinSchema), (req, res) => {
  const pin = String(req.body.pin || '').trim();
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
  if (req.user.pin) return res.status(403).json({ error: 'PIN уже задан — используйте смену PIN' });
  db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), req.user.id);
  addHist(req.user.id, 'Задан PIN (первый вход)', 'Приложение');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.post('/api/auth/set-pin', userGuard, (req, res) => {
  const pin = String(req.body.pin || '').trim();
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
  db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), req.user.id);
  addHist(req.user.id, 'Задан новый PIN', 'Приложение');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

authRouter.post('/api/auth/request-otp', async (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  if (ph10(p).length !== 10) return res.status(400).json({ error: 'Введите номер полностью' });
  const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
  if (!c) return res.status(404).json({ error: 'Профиль не найден' });

  const ipWait = Math.max(lockedSeconds(req, 'otp-send', p), lockedSeconds(req, 'login', p));
  if (ipWait > 0) return res.status(429).json({ error: `Слишком часто. Пауза ${ipWait} сек.` });

  const now = Date.now();
  const sendState = getOtpSendState('login', p);
  if (sendState && now - sendState.lastSent < 60000) {
    return res.status(429).json({ error: 'Код уже отправлен — повтор через минуту' });
  }
  if (sendState && now < sendState.windowEnds && sendState.sent >= 5) {
    return res.status(429).json({ error: 'Слишком много отправок — попробуйте позже' });
  }

  const code = String(crypto.randomInt(1000, 10000));
  let via = 'telegram';
  let delivery = c.tg
    ? await tgSend(c.tg, `🔑 Код для входа в приложение: ${code}\nДействует 5 минут. Никому не сообщайте!`)
    : { ok: false, reason: 'telegram_not_linked' };

  if (!delivery?.ok && SMS_AUTH_ENABLED) {
    via = 'sms';
    delivery = await sendSms(p, `Код для входа в приложение: ${code}. Действует 5 минут.`);
  }
  if (!delivery?.ok) {
    const error = SMS_AUTH_ENABLED
      ? 'Не удалось отправить код. Проверьте Telegram или попробуйте позже.'
      : 'Вход по коду сейчас доступен через Telegram. Привяжите Telegram к профилю или войдите по PIN.';
    return res.status(503).json({ error });
  }

  otpStore.set(p, { code, via, expires: now + 5 * 60 * 1000 });
  recordOtpSend('login', p, now);
  registerFail(req, 'otp-send', p);
  res.json({ ok: true, via });
});

authRouter.post('/api/auth/activate', userGuard, validate(ActivateCodeSchema), (req, res) => {
  const wait = lockedSeconds(req);
  if (wait > 0) return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });
  const code = String(req.body.code || '').trim();
  let role = null;
  if (ADMIN_CODE.length >= 16 && code.length >= 16 && safeEqual(code, ADMIN_CODE)) role = 'admin';
  else if (CASHIER_CODE.length >= 16 && code.length >= 16 && safeEqual(code, CASHIER_CODE)) role = 'cashier';
  else if (DISPATCH_CODE.length >= 16 && code.length >= 16 && safeEqual(code, DISPATCH_CODE)) role = 'dispatch';
  if (!role) {
    registerFail(req);
    return res.status(403).json({ error: 'Неверный код доступа' });
  }
  // F3.60: админ не понижает себя кодом активации — только «Отключить права» (/api/auth/deactivate, с защитой последнего админа).
  if (req.user.role === 'admin' && role !== 'admin') {
    return res.status(409).json({ error: 'Администратор не может понизить себя кодом активации' });
  }
  clearLock(req);
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
  grantBonus(c.id, c.src === QR_SOURCE ? 'qr' : 'signup');
  logEv(req.user.name, `активировал гостя ${c.name}`);
  res.json({ ok: true });
});

authRouter.get('/api/staff/pending', pendingGuard, (req, res) => {
  res.json({
    pending: db.prepare('SELECT id,name,phone,actcode,created_at FROM customers WHERE verified=0 AND actcode IS NOT NULL ORDER BY created_at DESC LIMIT 20').all()
  });
});

// Настройка бонусов (только админ): регистрация, регистрация по QR, установка приложения.
// Для каждого вида отдельно: штампы в кофейне и скидка ₽ в доставке. По умолчанию всё 0.
authRouter.get('/api/admin/bonuses', adminGuard, (req, res) => res.json(getBonusConfig()));
authRouter.put('/api/admin/bonuses', adminGuard, (req, res) => res.json(setBonusConfig(req.body || {})));

// Бонус за установку приложения. Клиент вызывает, когда приложение открыто установленным.
// Сервер сам не даёт начислить дважды.
authRouter.post('/api/bonus/install', userGuard, (req, res) => {
  const r = req.user.verified ? grantBonus(req.user.id, 'install') : null;
  res.json({ granted: !!r, code: r ? r.code : null });
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
  db.prepare('DELETE FROM tokens WHERE token=?').run(t);
  res.json({ ok: true });
});

authRouter.get('/api/me', userGuard, (req, res) => res.json({ customer: cust(req.user) }));

authRouter.put('/api/me', userGuard, (req, res) => {
  const name = String(req.body.name || '').trim() || 'Гость';
  db.prepare('UPDATE customers SET name=? WHERE id=?').run(name, req.user.id);
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});

// Удаление профиля клиента. Персональные данные стираются, заказы остаются без привязки
// к человеку (для учёта). Сотрудники не могут удалить себя через приложение.
authRouter.delete('/api/me', userGuard, (req, res) => {
  const cid = req.user.id;
  if (['admin', 'cashier', 'dispatch'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Сотрудник не может удалить профиль. Сначала снимите права.' });
  }
  db.transaction(() => {
    db.prepare("DELETE FROM tokens WHERE kind='user' AND ref=?").run(cid);
    db.prepare('DELETE FROM subs WHERE cid=?').run(cid);
    db.prepare('DELETE FROM fcm WHERE cid=?').run(cid);
    db.prepare('DELETE FROM promo_use WHERE cid=?').run(cid);
    db.prepare('DELETE FROM history WHERE cid=?').run(cid);
    const chatKeys = [cid, cid + ':c', cid + ':d'];
    const chatPlaceholders = chatKeys.map(() => '?').join(',');
    db.prepare(`DELETE FROM chat WHERE key IN (${chatPlaceholders})`).run(...chatKeys);
    db.prepare(`DELETE FROM chat_meta WHERE key IN (${chatPlaceholders})`).run(...chatKeys);
    db.prepare(`DELETE FROM chat_access WHERE key IN (${chatPlaceholders})`).run(...chatKeys);
    db.prepare("UPDATE orders SET cid='', name='', phone='', addr='', comment='' WHERE cid=?").run(cid);
    db.prepare('DELETE FROM customers WHERE id=?').run(cid);
  })();
  res.json({ ok: true });
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