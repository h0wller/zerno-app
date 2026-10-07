// Защита от крэша процесса Node 22 при сбоях фоновых пушей и вебхуков
process.on('unhandledRejection', (reason) => {
  console.error('[Background Rejection]:', (reason && reason.message) || reason);
});

import { initDatabase, getVapidPublicKey } from './server/db/index.js';
initDatabase();
import express from 'express';
import compression from 'compression';
import webpush from 'web-push';

// ── Конфигурация и БД ──
import { db, PORT, PUBLIC_DIR, WEBAPP_URL } from './server/config.js';
// ── Утилиты ──
import { nowISO, uid } from './server/utils/id-time.js';
import {
  userGuard, chatGuard, adminGuard, dispatchGuard,
  securityHeaders, corsMiddleware
} from './server/middleware/index.js';

import { tgSend, tgEnsureWebhook, TG_BOT_USERNAME, TG_CHANNEL, TG_WEBHOOK_SECRET, APP_URL } from './server/services/telegram.js';
import { sendPush } from './server/services/push.js';
// === domain routes ===
import { authRouter } from './server/routes/auth.js';
import { staffRouter } from './server/routes/staff.js';
import { promosRouter } from './server/routes/promos.js';
import ordersRouter, { ORDER_STATUS } from './server/routes/orders.js';
import chatRouter from './server/routes/chat.js';
import { createTgRouter } from './server/routes/tg.js';
import pushRouter from './server/routes/push.js';
import statsRouter from './server/routes/stats.js';
import { item, cust, addHist, logEv, getMeta, touch, issueToken } from './server/domain/helpers.js';

const app = express();
function appKb() {
  return {
    keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]],
    resize_keyboard: true,
  };
}

// ── Оптимизация сети: сжатие Gzip/Deflate для HTML, JS, CSS и JSON ──
app.use(compression({ threshold: 1024 }));
app.use(securityHeaders);
app.use(corsMiddleware);
/* Ф5.20: канонический хост — один origin для SW/кэша/PWA */
app.use((req, res, next) => {
  if (req.hostname === 'andcoffee.online' || req.hostname === 'www.andcoffee.online') {
    return res.redirect(301, 'https://friday.andcoffee.online' + req.originalUrl);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// ── Роутеры ──
app.use(authRouter);
app.use(staffRouter);
app.use(promosRouter);
app.use(ordersRouter);
app.use(chatRouter);
app.use(createTgRouter({ appKb }));
app.use(pushRouter);
app.use(statsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/clientlog', (req, res) => {
  console.log('[client]', (req.body && req.body.kind) || '?', (req.body && req.body.msg) || '');
  res.json({ ok: true });
});
app.get('/api/config', (req, res) => res.json({ tgUsername: TG_BOT_USERNAME }));

// [tg-diag v1] — диагностика Telegram-бота, добавляется scripts/add-tg-diag.mjs
app.get('/api/tg/diag', async (req, res) => {
  const token = process.env.TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  let me = null, err = null;
  if (token) {
    try {
      const r = await fetch('https://api.telegram.org/bot' + token + '/getMe');
      const j = await r.json();
      me = j.ok ? j.result : null;
      if (!j.ok) err = j.description;
    } catch (e) { err = e.message; }
  }
  const secret = process.env.TG_WEBHOOK_SECRET || '';
  res.json({
    token_prefix: token ? token.slice(0, 12) + '…' : null,
    token_len: token.length,
    bot: me ? '@' + me.username : null,
    bot_name: me ? me.first_name : null,
    telegram_error: err,
    env: {
      TEST_TOKEN: process.env.TEST_TOKEN ? 'set' : 'MISSING',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'MISSING',
      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || null,
      TG_BOT_USERNAME: process.env.TG_BOT_USERNAME || null,
      PUBLIC_URL: process.env.PUBLIC_URL || null,
      APP_URL: process.env.APP_URL || null,
      TG_WEBHOOK_SECRET: secret ? 'set (' + secret.length + ' chars)' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV || null,
    },
  });
});


/* ── меню ── */
app.get('/api/menu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='coffee'").all().map(item),
  updatedAt: getMeta(),
}));
app.get('/api/menu/all', adminGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu').all().map(item),
  updatedAt: getMeta(),
}));
app.get('/api/dmenu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='delivery'").all().map(item),
}));
app.post('/api/menu', adminGuard, (req, res) => {
  const p = req.body; p.id = p.id || uid('p');
  db.prepare('INSERT INTO menu(id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,section,opts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    p.id, p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null,
    p.section || 'coffee', JSON.stringify(p.opts || []));
  touch(); res.json({ ok: true, id: p.id });
});
app.put('/api/menu/:id', adminGuard, (req, res) => {
  const p = req.body;
  db.prepare('UPDATE menu SET cat=?,e=?,name=?,descr=?,comp=?,vol=?,price=?,tag=?,coffee=?,is_on=?,img=?,section=?,opts=? WHERE id=?').run(
    p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null,
    p.section || 'coffee', JSON.stringify(p.opts || []), req.params.id);
  touch(); res.json({ ok: true });
});
app.delete('/api/menu/:id', adminGuard, (req, res) => {
  db.prepare('DELETE FROM menu WHERE id=?').run(req.params.id);
  touch(); res.json({ ok: true });
});

/* ── статика с кэшированием (7 дней для JS/CSS, 1 год для медиа) ── */

app.use(express.static(PUBLIC_DIR, {
  maxAge: '7d',
  etag: true,
  setHeaders: (res, p) => {
    // sw.js ОБЯЗАН быть no-store, чтобы iOS не брала его из кэша
    if (p.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
} else if (p.endsWith('index.html') || p.endsWith('manifest.webmanifest') || /\.(svg|css|js)$/i.test(p)) {
  res.setHeader('Cache-Control', 'no-cache');
} else if (/\.(woff2?|png|jpe?g|ico|webp)$/i.test(p)) {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}
  }
}));
/* Временный обработчик сохранения маппинга картинок */
app.post('/save-mapping', express.urlencoded({ extended: true }), (req, res) => {
  const mapping = req.body || {};
  const stmt = db.prepare("UPDATE menu SET img = ? WHERE id = ?");
  let count = 0;

  const saveTx = db.transaction(() => {
    for (const [imgFile, dishId] of Object.entries(mapping)) {
      if (!dishId || !imgFile.endsWith('-card.webp')) continue;
      const imgPath = `/media/dishes/${imgFile}`;
      stmt.run(imgPath, dishId);
      count++;
    }
  });

  saveTx();
  db.pragma('vacuum;');

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;background:#F4EFE6;">
      <h1 style="color:#186A43;font-size:28px;">🎉 Успешно привязано ${count} блюд!</h1>
      <p style="font-size:16px;color:#3A2A1C;">Все фотографии записаны в SQLite лёгкими путями, Base64 полностью уничтожен.</p>
      <a href="/" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#C03B2A;color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;">Перейти в витрину</a>
    </body>
    </html>
  `);
});
const server = app.listen(PORT, () => { console.log(`☕ ЗЕРНО API запущен на порту ${PORT}`); tgEnsureWebhook(); });
process.on('SIGTERM', () => { console.log('[srv] SIGTERM, корректно закрываюсь…'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); });