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
function welcomeKeyboard(c) { // [tg-ux-v1]
  const rows = [
    [{ text: '☕ Кофейня — меню и штампы', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
    [{ text: '🍕 Пятница — доставка',     web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
  ];
  if (c) {
    rows.push([
      { text: '📦 Мои заказы',    web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } },
      { text: '💬 Задать вопрос', callback_data: 'support_choose' },
    ]);
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
    [{ text: '📱 Показать QR кассиру', web_app: { url: APP_URL + '/?src=tg&brand=coffee&tab=bonus' } }],
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
    // [tg-logging-v1]
    // Логируем всё входящее — по update_id и типу сразу видно, что прислал Telegram.
    try {
      var _kind = u.callback_query ? 'callback' : (u.message ? (u.message.contact ? 'contact' : 'message') : 'other');
      var _body = u.callback_query ? (u.callback_query.data || '') : (u.message ? (u.message.text || (u.message.contact ? 'phone' : '')) : '');
      console.log('[tg] in  kind=' + _kind + '  body=' + JSON.stringify(_body) + '  from=' + (u.message ? u.message.chat.id : (u.callback_query ? u.callback_query.from.id : '?')));
    } catch (e) {}

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
      if (data === 'orders') { // [tg-ux-v1]
        const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
        if (!c) {
          await tgSend(chatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());
          return;
        }
        await tgSend(chatId,
          '📦 Мои заказы открываются в приложении:',
          { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }
        );
        return;
      }

      /* 🔁 Повторить заказ — открываем WebApp с параметром */
      if (data.startsWith('reorder_')) {
        const orderId = data.slice(8);
        await tgSend(chatId, 'Открываю корзину с тем же составом 🛒', {
          inline_keyboard: [[{ text: '🛒 Открыть корзину', web_app: { url: `${APP_URL}/?src=tg&brand=delivery&reorder=${orderId}` } }]],
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
      // [tg-support-flow-v1]
      /* 💬 Поддержка: выбор темы в Telegram, потом открытие WebApp */
      if (data === 'support_choose') {
        await tgSend(chatId, '💬 По какой теме вопрос?', {
          inline_keyboard: [
            [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],
            [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],
          ]
        });
        return;
      }
      if (data === 'support_delivery' || data === 'support_coffee') {
        const ctx = data === 'support_delivery' ? 'delivery' : 'coffee';
        const label = ctx === 'delivery' ? '🍕 Доставка' : '☕ Кофейня';
        const cbMsgId = cb.message && cb.message.message_id;
        const openBtn = {
          inline_keyboard: [[
            { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&tab=chat&ctx=' + ctx } }
          ]]
        };
        if (cbMsgId && TG_TOKEN) {
          await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/editMessageText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: cbMsgId,
              text: 'Открываю чат: ' + label,
              reply_markup: openBtn,
            }),
          }).catch(function () {});
        } else {
          await tgSend(chatId, 'Открываю чат: ' + label, openBtn);
        }
        return;
      }

      if (data === 'link_phone') {
        const existing = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
        if (existing) {
          const left = 10 - existing.stamps;
          const line = existing.free
            ? '🎁 Бесплатных кофе: <b>' + existing.free + '</b>'
            : 'До подарка: <b>' + left + '</b> ' + (left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек'));
          await tgSend(chatId,
            'Профиль уже привязан ✅\n\n<b>' + existing.name + '</b> · ' + fmtPhone(existing.phone) + '\n\n' +
            stampBar(existing.stamps) + '\nШтампов: <b>' + existing.stamps + '/10</b>\n' + line,
            bonusKeyboard()
          );
          return;
        }
        await tgSend(chatId,
          'Привяжите номер телефона, чтобы копить штампы и получать бонусы.\n\n' +
          'Если у вас <b>уже есть профиль</b> в приложении — нажмите кнопку ниже и поделитесь номером 👇',
          appKb()
        );
        await tgSend(chatId,
          'Если профиля ещё нет — создайте его в приложении (10 секунд):',
          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
        );
        return;
      }

      return;
    }

    /* ────────────────────────── ОБЫЧНЫЕ СООБЩЕНИЯ ────────────────────────── */
    if (!u.message) return;
    const chatId = String(u.message.chat.id);
    const text = String(u.message.text || '').trim();

    // [fallback-text-callback-v1]
    // Telegram Desktop (некоторые версии) отправляет callback_data обычным текстом.
    // Перехватываем и обрабатываем как callback, чтобы кнопки работали везде.
    // [support-fallback-v1]
    if (text === 'link_phone' || text === 'bonus' || text === 'orders' ||
        text === 'support_choose' || text === 'support_delivery' || text === 'support_coffee') {
      const cbChatId = String(u.message.chat.id);

      // ── Поддержка: тема в Telegram, чат в PWA ──
      if (text === 'support_choose') {
        await tgSend(cbChatId, '💬 По какой теме вопрос?', {
          inline_keyboard: [
            [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],
            [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],
          ]
        });
        return;
      }
      if (text === 'support_delivery' || text === 'support_coffee') {
        const ctx = text === 'support_delivery' ? 'delivery' : 'coffee';
        const label = ctx === 'delivery' ? '🍕 Доставка' : '☕ Кофейня';
        await tgSend(cbChatId, 'Открываю чат: ' + label, {
          inline_keyboard: [[
            { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&tab=chat&ctx=' + ctx } }
          ]]
        });
        return;
      }

      if (text === 'link_phone') {
        const existing = db.prepare('SELECT * FROM customers WHERE tg=?').get(cbChatId);
        if (existing) {
          const left = 10 - existing.stamps;
          const line = existing.free
            ? '🎁 Бесплатных кофе: <b>' + existing.free + '</b>'
            : 'До подарка: <b>' + left + '</b> ' + (left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек'));
          await tgSend(cbChatId,
            'Профиль уже привязан ✅\n\n<b>' + existing.name + '</b> · ' + fmtPhone(existing.phone) + '\n\n' +
            stampBar(existing.stamps) + '\nШтампов: <b>' + existing.stamps + '/10</b>\n' + line,
            bonusKeyboard()
          );
          return;
        }
        await tgSend(cbChatId,
          'Привяжите номер телефона — копите штампы и получайте бонусы.\n\n' +
          'Если у вас <b>уже есть профиль</b> — нажмите кнопку ниже и поделитесь номером 👇',
          appKb()
        );
        await tgSend(cbChatId,
          'Если профиля ещё нет — создайте его в приложении:',
          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
        );
        return;
      }
      if (text === 'bonus') {
        const existing = db.prepare('SELECT * FROM customers WHERE tg=?').get(cbChatId);
        if (!existing) {
          await tgSend(cbChatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());
          return;
        }
        const left = 10 - existing.stamps;
        const line = existing.free
          ? '🎁 Бесплатных кофе: <b>' + existing.free + '</b>'
          : 'До подарка: <b>' + left + '</b> ' + (left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек'));
        await tgSend(cbChatId,
          '☕ <b>' + existing.name + '</b>\n\n' + stampBar(existing.stamps) + '\n\nШтампов: <b>' + existing.stamps + '/10</b>\n' + line,
          bonusKeyboard()
        );
        return;
      }
      if (text === 'orders') {
        const existing = db.prepare('SELECT * FROM customers WHERE tg=?').get(cbChatId);
        if (!existing) {
          await tgSend(cbChatId, 'Сначала привяжите профиль 👇', appKb());
          return;
        }
        const rows = db.prepare('SELECT id,no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 5').all(existing.id);
        if (!rows.length) {
          await tgSend(cbChatId, 'Заказов пока нет 🍕', {
            inline_keyboard: [[{ text: '🍕 Открыть меню', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }]],
          });
          return;
        }
        for (const o of rows) {
          const idx = STEPS.indexOf(o.status);
          const bar = STEPS.map((s, i) => i <= idx && idx >= 0 ? '●' : '○').join('─');
          const emoji = STATUS_EMOJI[o.status] || '•';
          await tgSend(cbChatId,
            '<b>#' + o.no + '</b> · ' + emoji + ' ' + (ORDER_STATUS[o.status] || o.status) + '\n' + bar + '\nИтого: <b>' + o.total + ' ₽</b>',
            { inline_keyboard: [
              [{ text: '📦 Детали', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders&no=' + o.no } }],
              [{ text: '🔁 Повторить', callback_data: 'reorder_' + o.id }],
            ]}
          );
        }
        return;
      }
    }

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
          [{ text: '☕ Кофейня', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
          [{ text: '🍕 Доставка', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
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
    if (text === '/orders') { // [tg-ux-v1]
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      if (!c) {
        await tgSend(chatId, 'Сначала привяжите профиль 👇', appKb());
        return;
      }
      await tgSend(chatId,
        '📦 Мои заказы открываются в приложении — статусы, состав и повтор одним тапом:',
        { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }
      );
      return;
    }

    /* 6. /help */
    if (text === '/help') { // [tg-ux-v1]
      await tgSend(chatId,
        'Что умею:\n' +
        '/menu — меню кофейни и доставки\n' +
        '/bonus — мои штампы и подарки\n' +
        '/orders — мои заказы\n' +
        '/start — главное меню\n\n' +
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
      tgSend(chatId,
        'Профиль с таким номером не найден ⚠️\n\nСоздайте его в приложении — займёт 10 секунд:',
        { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
      );
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
