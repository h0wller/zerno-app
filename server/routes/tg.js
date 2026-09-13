/* server/routes/tg.js — module-08: Telegram bot webhook */
import { Router } from 'express';
import { db } from '../db/connection.js';
import { tgSend, TG_TOKEN, TG_WEBHOOK_SECRET, APP_URL } from '../services/telegram.js';
import { fmtPhone } from '../utils/phone.js';
import { otpStore } from '../utils/otp.js';
import { grantWelcome } from '../domain/loyalty.js';
import { ORDER_STATUS } from './orders.js';

export function createTgRouter({ appKb }) {
  const tgRouter = Router();

  tgRouter.post('/api/tg/webhook', async (req, res) => {
    if (TG_WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token') !== TG_WEBHOOK_SECRET)
      return res.status(403).json({ error: 'bad secret' });
    const u = req.body; res.json({ ok: true });
    if (!u || !u.message) return;
    const chatId = String(u.message.chat.id);
    const text = String(u.message.text || '').trim();

    if (text.startsWith('/start reg_')) {
      const token = text.slice(11).trim();
      const st = otpStore.get('regtg:' + token);
      if (!st || Date.now() > st.expires) {
        tgSend(chatId, 'Ссылка для подтверждения устарела ⏳ Нажми «Подтвердить в Telegram» в приложении ещё раз.');
        return;
      }
      otpStore.set('regchat:' + chatId, { token, phone: st.phone, expires: Date.now() + 10 * 60 * 1000 });
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Подтверждаю номер ${fmtPhone(st.phone)} — нажмите кнопку ниже 👇`,
          reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true },
        }),
      }).catch(() => {});
      return;
    }

    if (text === '/start') {
      (async () => {
        await tgSend(chatId, '☕ Привет! Я бот «…и кофе» и доставки «Пятница».\n\nШтампы, бонусы, статусы заказов и акции — всё здесь. Меню открывается прямо в Telegram.');
        await tgSend(chatId, 'Выберите, что нужно 👇', appKb());
        try {
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '📱',
              reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true },
            }),
          });
        } catch (e) {}
      })();
      return;
    }

    if (text === '/menu') { tgSend(chatId, '🍕 Открываю меню доставки…', appKb()); return; }

    if (text === '/orders') {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      if (!c) { tgSend(chatId, 'Сначала привяжите профиль — нажмите «Поделиться номером» 👇', appKb()); return; }
      const rows = db.prepare('SELECT no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 3').all(c.id);
      const txt = rows.length
        ? rows.map(o => `#${o.no} · ${ORDER_STATUS[o.status] || o.status} · ${o.total} ₽`).join('\n')
        : 'Заказов пока нет — самое время выбрать пиццу 🍕';
      tgSend(chatId, `📦 Последние заказы:\n${txt}`, appKb());
      return;
    }

    if (text === '/help') {
      tgSend(chatId, 'Команды:\n/menu — меню и заказ\n/orders — мои заказы\n/start — привязать профиль\n\nИли напишите вопрос словами — отвечу я или сотрудник.', appKb());
      return;
    }

    if (u.message.contact) {
      const pend = otpStore.get('regchat:' + chatId);
      if (pend && Date.now() < pend.expires) {
        if (fmtPhone(u.message.contact.phone_number) === fmtPhone(pend.phone)) {
          otpStore.set('reg:' + fmtPhone(pend.phone), { code: null, confirmed: true, tgChat: chatId, expires: Date.now() + 10 * 60 * 1000 });
          otpStore.delete('regchat:' + chatId); otpStore.delete('regtg:' + pend.token);
          tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию — +1 штамп уже ваш 🎁');
        } else {
          tgSend(chatId, 'Номер не совпадает с указанным в приложении ⚠️ Нажмите кнопку ещё раз.');
        }
        return;
      }
    }

    const phone = u.message.contact ? u.message.contact.phone_number : text;
    const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(fmtPhone(phone));
    if (c) {
      db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);
      if (!c.welcome) {
        grantWelcome(c.id, 'Telegram');
        const linked = `✅ Готово, ${c.name}! Профиль привязан.\n🎁 Приветственный бонус начислен: +1 штамп!\n\nТеперь сюда будут приходить:`;
        await tgSend(chatId, linked);
        fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Выберите, что интересно:',
            reply_markup: { inline_keyboard: [
              [{ text: '☕ Кофейня — штампы и бонусы', url: APP_URL }],
              [{ text: '🍕 Доставка — заказать пиццу', url: APP_URL + '?brand=delivery' }],
            ]},
          }),
        }).catch(() => {});
      } else {
        tgSend(chatId, `✅ Готово, ${c.name}! Профиль привязан.\nТеперь штампы, статусы заказов и акции — сюда ☕🍕`);
      }
    } else if (u.message.contact) {
      tgSend(chatId, 'Профиль с таким номером не найден ⚠️ Создайте его в приложении и нажмите «Поделиться номером» ещё раз.');
    } else {
      tgSend(chatId, '☕ Я бот «…и кофе» + «Пятница». Нажмите /start, чтобы привязать профиль и получать бонусы и статусы заказов.');
    }
  });

  return tgRouter;
}