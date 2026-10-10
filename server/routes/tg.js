/* server/routes/tg.js — module-08: Telegram bot webhook. tg-refactor: v1 — добавлены /bonus, /orders с кнопками, callback_query. */

import { Router } from 'express';
import { db } from '../db/connection.js';
import { tgSend, TG_TOKEN, TG_WEBHOOK_SECRET, APP_URL } from '../services/telegram.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { otpStore } from '../utils/otp.js';
import { grantWelcome } from '../domain/loyalty.js';
import { cust, addHist, issueToken } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { nowISO } from '../utils/id-time.js';
import { ORDER_STATUS } from './orders.js';
import { stampBar, cupWord } from '../utils/loyalty-helpers.js';

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
      // [tg-support-clean-v1]
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
          : `До подарка: <b>${left}</b> ${cupWord(left)}`;
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
            { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&brand=' + ctx + '&tab=chat&ctx=' + ctx } }
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
            : 'До подарка: <b>' + left + '</b> ' + cupWord(left);
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
            { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&brand=' + ctx + '&tab=chat&ctx=' + ctx } }
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
            : 'До подарка: <b>' + left + '</b> ' + cupWord(left);
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
          : 'До подарка: <b>' + left + '</b> ' + cupWord(left);
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
      otpStore.set('regchat:' + chatId, { token, phone: st.phone, name: st.name || '', expires: Date.now() + 10 * 60 * 1000 });
      await tgSend(chatId, `Подтверждаю номер ${fmtPhone(st.phone)} — нажмите кнопку ниже 👇`, appKb());
      return;
    }

    /* 2. Обычный /start — приветствие с WebApp-кнопками */
    if (text === '/start') {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      const hello = c
        ? `С возвращением, <b>${c.name}</b>!\n\n${stampBar(c.stamps)}\nШтампов: <b>${c.stamps}/10</b>` +
          (c.free ? `\n🎁 Бесплатных кофе: <b>${c.free}</b>` : '')
        : '☕ Привет! Я бот «…и кофе» и доставки «Пятница» 🌊🍕\n\n' +
          'Привяжите номер и заберите приветственные бонусы:\n' +
          '☕ <b>+1 штамп</b> на кофе у моря\n' +
          '🍕 <b>Скидка 200 ₽</b> на первый заказ доставки (промокод <b>ПРИВЕТ</b>)\n\n' +
          'Штампы, меню, заказы и чат поддержки — всё здесь 👇';
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
        : `До подарка: <b>${left}</b> ${cupWord(left)}`;
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
        '🤖 <b>Чем я могу помочь:</b>\n\n' +
        '• <b>Команды:</b>\n' +
        '/menu — меню кофейни и доставки\n' +
        '/bonus — мои штампы и подарки\n' +
        '/orders — мои заказы и статус\n' +
        '/start — главное меню\n\n' +
        '• <b>Или просто спросите меня словами:</b>\n' +
        '— «Сколько у меня штампов?»\n' +
        '— «Где мой заказ?»\n' +
        '— «Часы работы и адрес»\n' +
        '— «Позови оператора»',
        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))
      );
      return;
    }

    /* 7. Привязка через contact — сохранённый flow */
    // [tg-web-seamless-auth-v1]
    if (u.message.contact) {
      const pend = otpStore.get('regchat:' + chatId);
      if (pend && Date.now() < pend.expires) {
        const contactPhone = fmtPhone(u.message.contact.phone_number);
        if (contactPhone === fmtPhone(pend.phone)) {
          const targetCust = db.prepare('SELECT * FROM customers WHERE phone=?').get(contactPhone);
          if (targetCust) {
            db.prepare('UPDATE customers SET tg=?, verified=1 WHERE id=?').run(chatId, targetCust.id);
            if (!targetCust.welcome) grantWelcome(targetCust.id, 'Telegram');
            addHist(targetCust.id, 'Вход через Telegram-подтверждение', 'Telegram');
          } else {
            const tgUserName = [u.message.from?.first_name, u.message.from?.last_name].filter(Boolean).join(' ');
            const newName = pend.name || tgUserName || 'Гость';
            const r = createCustomer(newName, contactPhone, '');
            if (!r.err && r.customer) {
              db.prepare('UPDATE customers SET tg=?, verified=1, consent=? WHERE id=?').run(chatId, nowISO() + ' v1', r.customer.id);
              grantWelcome(r.customer.id, 'Telegram');
              addHist(r.customer.id, 'Регистрация через Telegram', 'Telegram');
            }
          }

          const finalCust = db.prepare('SELECT * FROM customers WHERE phone=?').get(contactPhone);
          const sessionToken = finalCust ? issueToken(finalCust.id) : null;
          const custObj = finalCust ? cust(finalCust) : null;

          otpStore.set('reg:' + contactPhone, {
            code: null,
            confirmed: true,
            token: sessionToken,
            customer: custObj,
            tgChat: chatId,
            expires: Date.now() + 10 * 60 * 1000
          });
          otpStore.delete('regchat:' + chatId);
          otpStore.delete('regtg:' + pend.token);

          await tgSend(chatId, '👍 Номер подтверждён', { remove_keyboard: true });
          const baseSite = (typeof APP_URL !== 'undefined' && APP_URL) || 'https://friday.andcoffee.online';
          const authLink = sessionToken ? (baseSite + '/?auth_token=' + sessionToken) : (baseSite + '/?src=tg');

          await tgSend(chatId,
            '🎉 <b>Профиль готов, ' + (custObj ? custObj.name : '') + '!</b>\n\n' +
            'Ваши приветственные бонусы активированы:\n' +
            '☕ <b>+1 штамп</b> на кофе у моря\n' +
            '🍕 <b>Скидка 200 ₽</b> на доставку (промокод <b>ПРИВЕТ</b>)\n\n' +
            'В браузере вход выполнился автоматически. Или откройте сайт кнопкой ниже 👇',
            {
              inline_keyboard: [[
                { text: '🚀 Открыть сайт (вход выполнен)', url: authLink }
              ]]
            }
          );
        } else {
          await tgSend(chatId, 'Номер не совпадает с указанным в приложении ⚠️ Нажмите кнопку ещё раз.');
        }
        return;
      }
    }

    // [tg-smart-replies-v1]
    // [tg-remove-keyboard-clean-v1]
    // 8. Проверка, прислан ли номер телефона (контакт или 10 цифр)
    const isPhoneInput = !!u.message.contact || (text && ph10(text).length === 10);
    if (isPhoneInput) {
      if (u.message.contact) {
        await tgSend(chatId, '👍 Номер получен', { remove_keyboard: true });
      }
      const rawPhone = u.message.contact ? u.message.contact.phone_number : text;
      const formatted = fmtPhone(rawPhone);
      const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(formatted);
      if (c) {
        db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);
        if (!c.welcome) {
          grantWelcome(c.id, 'Telegram');
          // [tg-welcome-offer-200-v1]
          await tgSend(chatId,
            '✅ Готово, ' + c.name + '! Профиль привязан 🎉\n\n' +
            '🎁 <b>Ваши приветственные бонусы:</b>\n' +
            '☕ +1 штамп на кофе (уже в вашей карте бонусов)\n' +
            '🍕 Скидка 200 ₽ на заказ доставки по промокоду <b>ПРИВЕТ</b>',
            welcomeKeyboard(c)
          );
        } else {
          await tgSend(chatId, '✅ Готово, ' + c.name + '! Профиль привязан.', welcomeKeyboard(c));
        }
      } else if (u.message.contact) {
        await tgSend(chatId,
          'Профиль с таким номером не найден ⚠️\n\nСоздайте его в приложении — займёт 10 секунд:',
          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
        );
      } else {
        await tgSend(chatId,
          'Профиль с номером ' + formatted + ' не найден ⚠️\n\nСоздайте его в приложении за 10 секунд — и получите приветственный штамп 🎁',
          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
        );
      }
      return;
    }

    // 9. Умные ответы на естественные вопросы гостей
    const lower = text.toLowerCase();

    // а) Вызов поддержки / оператора
    if (/(оператор|человек|помощь|поддержк|админ|связаться|проблем|жалоб|ошибк|позови)/i.test(lower)) {
      await tgSend(chatId, '💬 Служба заботы на связи. По какой теме вопрос?', {
        inline_keyboard: [
          [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],
          [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],
        ]
      });
      return;
    }

    // б) Штампы / бонусы / бесплатный кофе
    if (/(штамп|бонус|бесплатн|подарок|зерн|зёрн|промокод|баллы|qr)/i.test(lower)) {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      if (c) {
        const left = 10 - c.stamps;
        const line = c.free
          ? ('🎁 Бесплатных кофе: <b>' + c.free + '</b>')
          : ('До подарка: <b>' + left + '</b> ' + cupWord(left));
        await tgSend(chatId,
          '☕ <b>' + c.name + '</b>\n\n' + stampBar(c.stamps) + '\n\nШтампов: <b>' + c.stamps + '/10</b>\n' + line,
          bonusKeyboard()
        );
      } else {
        await tgSend(chatId,
          '🎁 <b>Программа лояльности «…и кофе»:</b>\n\nКаждый 10-й кофе — бесплатно!\nПривяжите номер телефона, чтобы видеть свои штампы и копить бонусы 👇',
          welcomeKeyboard(null)
        );
      }
      return;
    }

    // в) Заказы / статус доставки
    if (/(заказ|где курьер|где доставка|доставк|статус заказа)/i.test(lower)) {
      await tgSend(chatId,
        '📦 Все ваши заказы со статусами и составом доступны в приложении:',
        { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }
      );
      return;
    }

    // г) Адрес / график работы
    if (/(где вы|адрес|находит|как добраться|время работ|режим работ|часы работ|до скольки|со скольки|янтарн)/i.test(lower)) {
      await tgSend(chatId,
        '📍 <b>Наши заведения в пгт Янтарный:</b>\n\n' +
        '🌊 <b>Кофейня «…и кофе»</b>\n' +
        'Советская ул., 70г (на берегу моря)\n' +
        '⏰ Май–сентябрь: 8:00–21:00\n' +
        '⏰ Октябрь–апрель: 8:00–20:00\n\n' +
        '🍕 <b>Доставка пиццы «Пятница»</b>\n' +
        'Советская ул., 38А\n' +
        '⏰ Ежедневно: 11:00–22:00 (~45 мин)\n' +
        '🛍 При самовывозе скидка −10%',
        {
          inline_keyboard: [
            [{ text: '☕ Меню кофейни', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
            [{ text: '🍕 Заказать доставку', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
          ]
        }
      );
      return;
    }

    // д) Меню / пицца / напитки
    if (/(меню|пицц|ролл|кофе|напитк|десерт)/i.test(lower)) {
      await tgSend(chatId, 'Меню открывается прямо в Telegram 🍕☕', {
        inline_keyboard: [
          [{ text: '☕ Кофейня', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
          [{ text: '🍕 Доставка', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
        ]
      });
      return;
    }

    // е) Мягкий ответ по умолчанию с кнопками действий
    const custCur = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
    await tgSend(chatId,
      'Я подскажу по меню, заказам и бонусам 🌊\nВыберите действие в меню ниже или напишите свой вопрос:',
      welcomeKeyboard(custCur)
    );
  });

  return tgRouter;
}