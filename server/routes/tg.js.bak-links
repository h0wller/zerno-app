/* server/routes/tg.js — module-08: Telegram bot webhook. tg-refactor: v1 — добавлены /bonus, /orders с кнопками, callback_query. */

import { Router } from 'express';
import { db } from '../db/connection.js';
import { tgSend, TG_TOKEN, TG_WEBHOOK_SECRET, APP_URL } from '../services/telegram.js';
import { fmtPhone } from '../utils/phone.js';
import { otpStore } from '../utils/otp.js';
import { grantWelcome } from '../domain/loyalty.js';
import { ORDER_STATUS } from './orders.js';

const STATUS_EMOJI = { new:'🆕', accept:'✅', cook:'👨‍🍳', way:'🛵', done:'🏁', cancel:'❌' };
const STEPS = ['new', 'accept', 'cook', 'way', 'done'];

/* Inline-клавиатура для приветствия. c — customer или null. */
function welcomeKeyboard(c) {
  const rows = [
    [{ text: '☕ Кофейня — меню и штампы', web_app: { url: APP_URL } }],
    [{ text: '🍕 Пятница — доставка',     web_app: { url: APP_URL + '?brand=delivery' } }],
  ];
  if (c) {
    rows.push([{ text: '🎁 Мои бонусы', callback_data: 'bonus' },
               { text: '📦 Мои заказы', callback_data: 'orders' }]);
  } else {
    rows.push([{ text: '🔗 Привязать номер', callback_data: 'link_phone' }]);
  }
  return { inline_keyboard: rows };
}

/* Answer на callback — обязательно, иначе у гостя крутится часик на кнопке. */
async function answerCallback(cbId) {
  if (!cbId || !TG_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId }),
  }).catch(() => {});
}

/* Прогресс-бар штампов: 🫘 🫘 🫘 ⚪ ⚪ ⚪ ⚪ ⚪ ⚪ ⚪ */
function stampBar(n) {
  return '🫘'.repeat(Math.min(10, Math.max(0, n))) +
         '⚪'.repeat(Math.max(0, 10 - Math.min(10, Math.max(0, n))));
}

/* Клавиатура с QR и обновлением. */
function bonusKeyboard() {
  return { inline_keyboard: [
    [{ text: '📱 Показать QR кассиру', web_app: { url: APP_URL + '?tab=bonus' } }],
    [{ text: '🔄 Обновить', callback_data: 'bonus' }],
  ]};
}

export function createTgRouter({ appKb }) {
  const tgRouter = Router();

  tgRouter.post('/api/tg/webhook', async (req, res) => {
    if (TG_WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token') !== TG_WEBHOOK_SECRET)
      return res.status(403).json({ error: 'bad secret' });

    const u = req.body;
    res.json({ ok: true });
    if (!u) return;

    /* ────────────────────────── CALLBACK QUERY ──────────────────────────
       Нажатия на inline-кнопки. Обрабатываем ДО всего остального. */
    if (u.callback_query) {
      const cb = u.callback_query;
      const chatId = String(cb.message?.chat?.id || cb.from?.id || '');
      const data = String(cb.data || '');
      await answerCallback(cb.id);
      if (!chatId) return;

      /* 🎁 Мои бонусы */
      if (data === 'bonus') {
        const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
        if (!c) {
          await tgSend(chatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());
          return;
        }
        const left = 10 - c.stamps;
        const line = c.free
          ? `🎁 Бесплатных кофе: <b>${c.free}</b>`
          : `До подарка: <b>${left}</b> ${left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек')}`;
        await tgSend(chatId,
          `☕ <b>${c.name}</b>\n\n${stampBar(c.stamps)}\n\n` +
          `Штампов: <b>${c.stamps}/10</b>\n${line}`,
          bonusKeyboard()
        );
        return;
      }

      /* 📦 Мои заказы */
      if (data === 'orders') {
        const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
        if (!c) {
          await tgSend(chatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());
          return;
        }
        const rows = db.prepare('SELECT id,no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 5').all(c.id);
        if (!rows.length) {
          await tgSend(chatId, 'Заказов пока нет — самое время выбрать пиццу 🍕', {
            inline_keyboard: [[{ text: '🍕 Открыть меню', web_app: { url: APP_URL + '?brand=delivery' } }]],
          });
          return;
        }
        for (const o of rows) {
          const idx = STEPS.indexOf(o.status);
          const bar = STEPS.map((s, i) => i <= idx && idx >= 0 ? '●' : '○').join('─');
          const emoji = STATUS_EMOJI[o.status] || '•';
          await tgSend(chatId,
            `<b>#${o.no}</b> · ${emoji} ${ORDER_STATUS[o.status] || o.status}\n${bar}\nИтого: <b>${o.total} ₽</b>`,
            { inline_keyboard: [
              [{ text: '📦 Детали', web_app: { url: `${APP_URL}/?src=tg&tab=orders&no=${o.no}` } }],
              [{ text: '🔁 Повторить', callback_data: `reorder_${o.id}` }],
            ]}
          );
        }
        return;
      }

      /* 🔁 Повторить заказ — открываем WebApp с параметром */
      if (data.startsWith('reorder_')) {
        const orderId = data.slice(8);
        await tgSend(chatId, 'Открываю корзину с тем же составом 🛒', {
          inline_keyboard: [[{ text: '🛒 Открыть корзину', web_app: { url: `${APP_URL}/?reorder=${orderId}` } }]],
        });
        return;
      }

      /* 💬 Позвать оператора — открываем чат */
      if (data.startsWith('call_')) {
        const orderId = data.slice(5);
        await tgSend(chatId, 'Открываю чат поддержки 💬', {
          inline_keyboard: [[{ text: '💬 Открыть чат', web_app: { url: `${APP_URL}/?src=tg&tab=chat&no=${orderId}` } }]],
        });
        return;
      }

      /* 🔗 Привязать номер */
      if (data === 'link_phone') {
        await tgSend(chatId, 'Нажмите кнопку ниже — привяжем профиль к этому Telegram 👇', appKb());
        return;
      }

      return;
    }

    /* ────────────────────────── ОБЫЧНЫЕ СООБЩЕНИЯ ────────────────────────── */
    if (!u.message) return;
    const chatId = String(u.message.chat.id);
    const text = String(u.message.text || '').trim();

    /* 1. Регистрация через одноразовую ссылку (фронт шлёт reg_<token>) */
    if (text.startsWith('/start reg_')) {
      const token = text.slice(11).trim();
      const st = otpStore.get('regtg:' + token);
      if (!st || Date.now() > st.expires) {
        tgSend(chatId, 'Ссылка для подтверждения устарела ⏳\nНажми «Подтвердить в Telegram» в приложении ещё раз.');
        return;
      }
      otpStore.set('regchat:' + chatId, { token, phone: st.phone, expires: Date.now() + 10 * 60 * 1000 });
      await tgSend(chatId, `Подтверждаю номер ${fmtPhone(st.phone)} — нажмите кнопку ниже 👇`, appKb());
      return;
    }

    /* 2. Обычный /start — приветствие с WebApp-кнопками */
    if (text === '/start') {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      const hello = c
        ? `С возвращением, <b>${c.name}</b>!\n\n${stampBar(c.stamps)}\nШтампов: <b>${c.stamps}/10</b>` +
          (c.free ? `\n🎁 Бесплатных кофе: <b>${c.free}</b>` : '')
        : '☕ Привет! Я бот «…и кофе» и доставки «Пятница».\n\nЗдесь: штампы, бонусы, заказы и поддержка.\nНачнём?';
      await tgSend(chatId, hello, welcomeKeyboard(c));
      return;
    }

    /* 3. /menu — WebApp-кнопка (а не обманчивый текст) */
    if (text === '/menu') {
      await tgSend(chatId, 'Меню открывается прямо в Telegram 🍕☕', {
        inline_keyboard: [
          [{ text: '☕ Кофейня', web_app: { url: APP_URL } }],
          [{ text: '🍕 Доставка', web_app: { url: APP_URL + '?brand=delivery' } }],
        ],
      });
      return;
    }

    /* 4. /bonus — прогресс-бар штампов */
    if (text === '/bonus') {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      if (!c) {
        await tgSend(chatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());
        return;
      }
      const left = 10 - c.stamps;
      const line = c.free
        ? `🎁 Бесплатных кофе: <b>${c.free}</b>`
        : `До подарка: <b>${left}</b> ${left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек')}`;
      await tgSend(chatId,
        `☕ <b>${c.name}</b>\n\n${stampBar(c.stamps)}\n\n` +
        `Штампов: <b>${c.stamps}/10</b>\n${line}`,
        bonusKeyboard()
      );
      return;
    }

    /* 5. /orders — список с action-кнопками */
    if (text === '/orders') {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      if (!c) {
        await tgSend(chatId, 'Сначала привяжите профиль 👇', appKb());
        return;
      }
      const rows = db.prepare('SELECT id,no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 5').all(c.id);
      if (!rows.length) {
        await tgSend(chatId, 'Заказов пока нет — самое время выбрать пиццу 🍕', {
          inline_keyboard: [[{ text: '🍕 Открыть меню', web_app: { url: APP_URL + '?brand=delivery' } }]],
        });
        return;
      }
      for (const o of rows) {
        const idx = STEPS.indexOf(o.status);
        const bar = STEPS.map((s, i) => i <= idx && idx >= 0 ? '●' : '○').join('─');
        const emoji = STATUS_EMOJI[o.status] || '•';
        await tgSend(chatId,
          `<b>#${o.no}</b> · ${emoji} ${ORDER_STATUS[o.status] || o.status}\n${bar}\nИтого: <b>${o.total} ₽</b>`,
          { inline_keyboard: [
            [{ text: '📦 Детали', web_app: { url: `${APP_URL}/?src=tg&tab=orders&no=${o.no}` } }],
            [{ text: '🔁 Повторить', callback_data: `reorder_${o.id}` }],
          ]}
        );
      }
      return;
    }

    /* 6. /help */
    if (text === '/help') {
      await tgSend(chatId,
        'Что умею:\n' +
        '/menu — меню и заказ (открывается в приложении)\n' +
        '/bonus — мои штампы и подарки\n' +
        '/orders — мои заказы\n' +
        '/start — перезапустить\n\n' +
        'Или пишите вопрос словами — отвечу сам или позову сотрудника.',
        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))
      );
      return;
    }

    /* 7. Привязка через contact — сохранённый flow */
    if (u.message.contact) {
      const pend = otpStore.get('regchat:' + chatId);
      if (pend && Date.now() < pend.expires) {
        if (fmtPhone(u.message.contact.phone_number) === fmtPhone(pend.phone)) {
          otpStore.set('reg:' + fmtPhone(pend.phone), { code: null, confirmed: true, tgChat: chatId, expires: Date.now() + 10 * 60 * 1000 });
          otpStore.delete('regchat:' + chatId);
          otpStore.delete('regtg:' + pend.token);
          tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию — +1 штамп уже ваш 🎁');
        } else {
          tgSend(chatId, 'Номер не совпадает с указанным в приложении ⚠️ Нажмите кнопку ещё раз.');
        }
        return;
      }
    }

    /* 8. Пользователь прислал contact или текст — ищем профиль по номеру */
    const phone = u.message.contact ? u.message.contact.phone_number : text;
    const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(fmtPhone(phone));
    if (c) {
      db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);
      if (!c.welcome) {
        grantWelcome(c.id, 'Telegram');
        await tgSend(chatId, `✅ Готово, ${c.name}! Профиль привязан.\n🎁 Приветственный бонус начислен: +1 штамп!`, welcomeKeyboard(c));
      } else {
        await tgSend(chatId, `✅ Готово, ${c.name}! Профиль привязан.`, welcomeKeyboard(c));
      }
    } else if (u.message.contact) {
      tgSend(chatId, 'Профиль с таким номером не найден ⚠️\nСоздайте его в приложении и нажмите «Поделиться номером» ещё раз.');
    } else {
      /* Свободный текст без команды — мягкая подсказка */
      tgSend(chatId,
        '☕ Я бот «…и кофе» + «Пятница».\nНажмите /start, чтобы увидеть меню, или выберите действие ниже:',
        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))
      );
    }
  });

  return tgRouter;
}
