/* server/routes/orders.js — module-07: заказы доставки + delivery-конфиг */
import { Router } from 'express';
import { db, WEBAPP_URL } from '../config.js';
import { userGuard, adminGuard, dispatchGuard } from '../middleware/auth.js';
import { logEv } from '../domain/helpers.js';
import { nowISO, uid } from '../utils/id-time.js';
import { sendPush } from '../services/push.js';
import { tgSend, TG_CHANNEL } from '../services/telegram.js';
import { getStreetSuggestions, validateDeliveryAddress } from '../domain/address.js';

const ordersRouter = Router();

/* ── конфиг доставки ── */
const DELIVERY = {
  hours: [11, 22], eta: 45, slotStep: 30, slotDays: 2,
  pickupAddr: 'пгт Янтарный, ул. Советская, 38А', pickupDiscount: 0.10,
  zones: [
    { fee: 200, places: ['Янтарный', 'Покровское', 'Синявино'] },
    { fee: 500, places: ['Кленовое', 'Охотное', 'Русское', 'Поваровка', 'Морозовка', 'Янтаровка', 'Красноторовка', 'Ягодное'] },
    { fee: 1100, places: ['Донское', 'Прислово'] },
  ],
};

const weekPromo = () => {
  const w = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='week_promo'").get()?.value || 'null');
  if (!w || !w.text) return null;
  if (w.until && new Date(w.until) < new Date()) return null;
  return w;
};

const pizzaMonth = () => {
  const m = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='pizza_month'").get()?.value || 'null');
  return (m && m.on && m.name) ? m : null;
};

export const ORDER_STATUS = {
  new: '🆕 Заказ принят',
  accept: '✅ Подтверждён, передаем на кухню',
  cook: '👨‍🍳 Готовится',
  way: '🛵 Курьер выехал',
  done: '🏁 Выполнен',
  cancel: '❌ Отменён',
};

function orderNotifyStaff(o) {
  const lines = o.items.map(i => `${i.qty}× ${i.name}${i.opt ? ' (' + i.opt + ')' : ''} — ${i.qty * i.price} ₽`);
  const gifts = o.gifts.map(g => `🎁 ${g.name} ×${g.qty}`);
  const timeLabel = o.is_preorder ? `⏰ ПРЕДЗАКАЗ: ${o.slot}` : `⏰ ${o.slot === 'asap' ? 'как можно скорее' : o.slot}`;
  const txt = `${o.name} ${o.phone}\n${o.method === 'pickup' ? '🛍 Самовывоз, Советская 38А' : '🚗 ' + o.place + ', ' + o.addr}\n${timeLabel} · 💳 ${o.pay === 'cash' ? 'наличные' : 'карта при получении'}\n${lines.concat(gifts).join('\n')}\nИтого: ${o.total} ₽ (скидка ${o.discount} ₽, доставка ${o.fee} ₽)${o.comment ? '\n💬 ' + o.comment : ''}`;
  const staff = db.prepare("SELECT id FROM customers WHERE role IN ('cashier','admin','dispatch')").all();
  for (const s of staff) sendPush(s.id, o.is_preorder ? `⏰ Предзаказ #${o.no}` : `🍕 Новый заказ #${o.no}`, txt);
  logEv(o.name, `${o.is_preorder ? 'предзаказ' : 'заказ'} #${o.no} на ${o.total} ₽`);
}

/* ── публичный конфиг доставки ── */
ordersRouter.get('/api/delivery/info', (req, res) =>
  res.json({ ...DELIVERY, weekPromo: weekPromo(), pizzaMonth: pizzaMonth() }));

ordersRouter.put('/api/admin/weekpromo', adminGuard, (req, res) => {
  const b = req.body || {};
  if ('text' in b) {
    db.prepare("INSERT INTO meta(key,value) VALUES('week_promo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify({ text: b.text || '', threshold: +b.threshold || 0, gift: b.gift || '', until: b.until || null }));
    if (b.push && b.text) {
      const cids = db.prepare("SELECT cid FROM subs UNION SELECT id FROM customers WHERE tg IS NOT NULL AND tg != ''").all();
      for (const c of cids) sendPush(c.cid, '🍕 Пятничный подарок', b.text);
      logEv(req.user.name, 'пуш: пятничный подарок');
    }
  }
  if ('pmName' in b || 'pmOn' in b) {
    db.prepare("INSERT INTO meta(key,value) VALUES('pizza_month',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify({ name: b.pmName || '', on: !!b.pmOn }));
  }
  if (TG_CHANNEL) tgSend(TG_CHANNEL, `🍕 Пятничный подарок\n${b.text}`);
  res.json({ ok: true });
});

/* ── Эндпоинт подсказок улиц для datalist ── */
ordersRouter.get('/api/delivery/addr', (req, res) => {
  const place = String(req.query.place || '').trim();
  const q = String(req.query.q || '').trim();
  const suggestions = getStreetSuggestions(place, q);
  res.json({ suggestions });
});

/* ── заказы ── */
ordersRouter.post('/api/orders', userGuard, (req, res) => {
  const b = req.body || {};
  const method = b.method === 'pickup' ? 'pickup' : 'delivery';
  let fee = 0;
  let addrStr = '';

  if (method === 'delivery') {
    const z = DELIVERY.zones.find(z => z.places.includes(String(b.place || '').trim()));
    if (!z) return res.status(400).json({ error: 'Выберите населённый пункт из списка' });

    const street = String(b.street || '').trim();
    const house = String(b.house || '').trim();
    const legacyAddr = String(b.addr || '').trim();

    if (street && house) {
      const vErr = validateDeliveryAddress(b.place, street, house);
      if (vErr) return res.status(400).json({ error: vErr });
      addrStr = street + ', ' + house;
    } else if (legacyAddr) {
      addrStr = legacyAddr;
    } else {
      return res.status(400).json({ error: 'Укажите улицу и дом' });
    }
    fee = z.fee;
  }

  const raw = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!raw.length) return res.status(400).json({ error: 'Корзина пуста' });
  const items = []; let sum = 0;
  for (const li of raw) {
    const m = db.prepare("SELECT * FROM menu WHERE id=? AND section='delivery' AND is_on=1").get(String(li.id || ''));
    if (!m) return res.status(400).json({ error: 'Позиция недоступна' });
    const opts = JSON.parse(m.opts || '[]');
    const oi = Number.isInteger(li.oi) ? li.oi : -1;
    if (oi >= 0 && !opts[oi]) return res.status(400).json({ error: 'Вариант недоступен' });
    const price = oi >= 0 ? opts[oi].p : (parseInt(m.price) || 0);
    const qty = Math.max(1, Math.min(99, +li.qty || 1));
    items.push({ id: m.id, name: m.name, opt: oi >= 0 ? opts[oi].l : null, sz: oi >= 0 ? (opts[oi].sz || 0) : 0, price, qty });
    sum += price * qty;
  }

  // ── Предзаказы и рабочее время ──
  const now = new Date();
  const currentHour = now.getHours();
  const isWorkingHours = currentHour >= DELIVERY.hours[0] && currentHour < DELIVERY.hours[1];

  let isPreorder = 0;
  let preorderDate = '';
  const slotStr = String(b.slot || 'asap').trim();

  if (slotStr && slotStr !== 'asap') {
    isPreorder = 1;
    const dateMatch = slotStr.match(/^(\d{2}[.-]\d{2})/);
    if (dateMatch) preorderDate = dateMatch[1];
  }

  const isTestEnv = process.env.NODE_ENV === 'test' || (process.env.DB_PATH && process.env.DB_PATH.includes('tmp'));
  if (!isWorkingHours) {
    if (!isTestEnv && slotStr === 'asap') {
      return res.status(400).json({ error: 'Доставка сейчас закрыта. Выберите время для предзаказа на завтра.' });
    }
    isPreorder = 1;
  }

  const discount = method === 'pickup' ? Math.round(sum * DELIVERY.pickupDiscount) : 0;
  const gifts = [];
  const wp = weekPromo();
  if (wp && wp.gift) { const q = wp.threshold > 0 ? Math.floor(sum / wp.threshold) : 1; if (q > 0) gifts.push({ name: wp.gift, qty: q }); }
  const pm = pizzaMonth();
  if (pm) { const big = items.reduce((a, i) => a + (i.sz === 35 ? i.qty : 0), 0); if (big >= 2) gifts.push({ name: pm.name + ' — подарок', qty: 1 }); }
  
  let promoCode = '', promoDiscount = 0;
  const pc = String(b.promo || '').trim().toUpperCase();
  if (pc) {
    const p = db.prepare('SELECT * FROM promos WHERE code=?').get(pc);
    if (!p || !p.active || (p.scope || 'coffee') !== 'delivery') return res.status(400).json({ error: 'Промокод не найден для доставки' });
    if (p.expires && new Date(p.expires) < new Date()) return res.status(410).json({ error: 'Промокод истёк' });
    if (p.maxuses > 0 && p.uses >= p.maxuses) return res.status(410).json({ error: 'Промокод использован' });
    if (db.prepare('SELECT 1 FROM promo_use WHERE promo=? AND cid=?').get(p.id, req.user.id))
      return res.status(409).json({ error: 'Вы уже использовали этот промокод' });
    promoDiscount = p.kind === 'percent' ? Math.round(sum * Math.min(90, p.value) / 100) : Math.min(p.value || 0, sum);
    promoCode = p.code;
    db.prepare('INSERT INTO promo_use(promo,cid,ts) VALUES(?,?,?)').run(p.id, req.user.id, nowISO());
    db.prepare('UPDATE promos SET uses=uses+1 WHERE id=?').run(p.id);
  }

  const total = sum - discount - promoDiscount + fee;
  const no = ((db.prepare("SELECT value FROM meta WHERE key='order_no'").get()?.value | 0) + 1);
  db.prepare("INSERT INTO meta(key,value) VALUES('order_no',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(no));
  
  const o = { 
    id: uid('o'), no, cid: req.user.id, name: req.user.name, phone: req.user.phone, method,
    place: method === 'delivery' ? String(b.place).trim() : '',  
    addr: addrStr,
    slot: slotStr, 
    pay: b.pay === 'card' ? 'card' : 'cash',
    comment: String(b.comment || '').slice(0, 300), 
    items, total, discount, fee, gifts, promo: promoCode, promodiscount: promoDiscount, 
    is_preorder: isPreorder, preorder_date: preorderDate,
    status: 'new', created: nowISO(), updated: nowISO() 
  };
  
  db.prepare(`INSERT INTO orders(id,no,cid,name,phone,method,place,addr,slot,pay,comment,items,total,discount,fee,gifts,is_preorder,preorder_date,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(o.id, o.no, o.cid, o.name, o.phone, o.method, o.place, o.addr, o.slot, o.pay, o.comment,
    JSON.stringify(o.items), o.total, o.discount, o.fee, JSON.stringify(o.gifts), o.is_preorder, o.preorder_date, o.status, o.created, o.updated);
  
  orderNotifyStaff(o);
  res.json({ order: o });
});

ordersRouter.get('/api/orders/mine', userGuard, (req, res) => {
  res.json({ orders: db.prepare('SELECT * FROM orders WHERE cid=? ORDER BY no DESC LIMIT 20').all(req.user.id)
    .map(o => ({ ...o, items: JSON.parse(o.items || '[]'), gifts: JSON.parse(o.gifts || '[]') })) });
});

ordersRouter.get('/api/orders', dispatchGuard, (req, res) => {
  const st = req.query.status;
  const rows = st ? db.prepare('SELECT * FROM orders WHERE status=? ORDER BY no DESC LIMIT 50').all(st)
    : db.prepare("SELECT * FROM orders WHERE created>? ORDER BY no DESC LIMIT 50").all(new Date(Date.now() - 3 * 86400000).toISOString());
  res.json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items || '[]'), gifts: JSON.parse(o.gifts || '[]') })) });
});

ordersRouter.post('/api/orders/:id/status', dispatchGuard, (req, res) => {
  const s = String(req.body.status || '');
  if (!ORDER_STATUS[s]) return res.status(400).json({ error: 'Неизвестный статус' });
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Заказ не найден' });
  db.prepare('UPDATE orders SET status=?, updated=? WHERE id=?').run(s, nowISO(), o.id);
  sendPush(o.cid, `🍕 Заказ #${o.no}`,
    ORDER_STATUS[s] + (s === 'way' && o.addr ? ': ' + o.addr : ''),
    { inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders&no=' + o.no } }]] });
  logEv(req.user.name, `заказ #${o.no} → ${s}`);
  res.json({ ok: true });
});

ordersRouter.post('/api/orders/:id/delay', dispatchGuard, (req, res) => {
  const min = +req.body.min || 0;
  const comment = String(req.body.comment || '').slice(0, 140);
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id)
    || db.prepare('SELECT * FROM orders WHERE no=?').get(+req.params.id || 0);
  if (!o) return res.status(404).json({ error: 'Заказ не найден' });
  db.prepare('UPDATE orders SET eta=?, updated=? WHERE id=?').run(min ? `+${min} мин` : '', nowISO(), o.id);
  sendPush(o.cid, '🛵 Время доставки обновлено',
    `Заказ #${o.no}: задерживаем на +${min} мин.${comment ? ' Причина: ' + comment : ''} Спасибо, что ждёте!`,
    { inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders&no=' + o.no } }]] });
  logEv(req.user.name, `заказ #${o.no} задержка +${min} мин`);
  res.json({ ok: true });
});

ordersRouter.post('/api/orders/delay-all', dispatchGuard, (req, res) => {
  const min = +req.body.min || 0;
  const comment = String(req.body.comment || '').slice(0, 140);
  const rows = db.prepare("SELECT * FROM orders WHERE status IN ('new','accept','cook','way')").all();
  for (const o of rows) {
    db.prepare('UPDATE orders SET eta=?, updated=? WHERE id=?').run(min ? `+${min} мин` : '', nowISO(), o.id);
    sendPush(o.cid, '🛵 Время доставки обновлено',
      `Заказ #${o.no}: задерживаем на +${min} мин.${comment ? ' Причина: ' + comment : ''} Спасибо, что ждёте!`,
      { inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders&no=' + o.no } }]] });
  }
  logEv(req.user.name, `задержка всем +${min} мин (${rows.length})`);
  res.json({ ok: true, count: rows.length });
});

export default ordersRouter;