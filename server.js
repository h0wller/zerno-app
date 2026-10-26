// Защита от крэша процесса Node 22 при сбоях фоновых пушей и вебхуков
process.on('unhandledRejection', (reason) => {
  console.error('[Background Rejection]:', (reason && reason.message) || reason);
});

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { initDatabase } from './server/db/index.js';
initDatabase();
import express from 'express';
import compression from 'compression';

// ── Конфигурация и БД ──
import { db, PORT, PUBLIC_DIR } from './server/config.js';
// ── Утилиты ──
import { uid } from './server/utils/id-time.js';
import {
  adminGuard, menuGuard,
  securityHeaders, corsMiddleware
} from './server/middleware/index.js';

import { tgEnsureWebhook, TG_BOT_USERNAME } from './server/services/telegram.js';
// === domain routes ===
import { authRouter } from './server/routes/auth.js';
import { staffRouter } from './server/routes/staff.js';
import { promosRouter } from './server/routes/promos.js';
import ordersRouter from './server/routes/orders.js';
import chatRouter from './server/routes/chat.js';
import { createTgRouter } from './server/routes/tg.js';
import pushRouter from './server/routes/push.js';
import statsRouter from './server/routes/stats.js';
import { item, getMeta, touch } from './server/domain/helpers.js';

const app = express();
// За прокси (Railway и т.п.) задайте TRUST_PROXY=1, иначе req.ip будет адресом прокси.
// Без прокси не доверяем заголовкам клиента: иначе X-Forwarded-For обходит блокировку PIN.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
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
  // Ограничиваем длину, чтобы сюда нельзя было засорить логи большим текстом.
  const kind = String((req.body && req.body.kind) || '?').slice(0, 40);
  const msg = String((req.body && req.body.msg) || '').slice(0, 300);
  console.log('[client]', kind, msg);
  res.json({ ok: true });
});
app.get('/api/config', (req, res) => res.json({ tgUsername: TG_BOT_USERNAME }));

// [tg-diag v1] — диагностика Telegram-бота
app.get('/api/tg/diag', adminGuard, async (req, res) => {
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
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='coffee' ORDER BY sort_order ASC, id ASC").all().map(item),
  updatedAt: getMeta(),
}));
app.get('/api/menu/all', menuGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu ORDER BY sort_order ASC, id ASC').all().map(item),
  updatedAt: getMeta(),
}));
app.get('/api/dmenu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='delivery' ORDER BY sort_order ASC, id ASC").all().map(item),
}));
app.post('/api/menu', adminGuard, (req, res) => {
  const sec = req.body.section === 'delivery' ? 'delivery' : 'coffee';
  const maxOrd = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS m FROM menu WHERE section = ?').get(sec).m;
  const p = req.body; p.id = p.id || uid('p');
db.prepare('INSERT INTO menu(id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,section,opts,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
  p.id, p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
  p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null,
  p.section || 'coffee', JSON.stringify(p.opts || []), maxOrd);  touch(); res.json({ ok: true, id: p.id });
});
app.put('/api/menu/reorder', adminGuard, (req, res) => {
  const sec = req.body.brand === 'delivery' ? 'delivery' : 'coffee';
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) return res.status(400).json({ error: 'Пустой порядок' });
  const upd = db.prepare('UPDATE menu SET sort_order = ? WHERE id = ? AND section = ?');
  const changed = db.transaction((list) => {
    let n = 0;
    list.forEach((id, i) => { n += upd.run(i + 1, id, sec).changes; });
    return n;
  })(ids);
  if (changed !== ids.length) return res.status(409).json({ error: 'Не все позиции найдены в секции' });
  touch();
  res.json({ ok: true });
});
app.put('/api/menu/:id', menuGuard, (req, res) => {
  const id = String(req.params.id || '').trim();
  const existing = db.prepare('SELECT * FROM menu WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Позиция не найдена' });
  const bodyKeys = Object.keys(req.body || {});
  const onlyOn = bodyKeys.length === 1 && bodyKeys[0] === 'on';
  if (req.user.role !== 'admin') {
    if (!onlyOn) {
      return res.status(403).json({ error: 'Доступно только переключение стоп-листа (on)' });
    }
    const onVal = req.body.on ? 1 : 0;
    db.prepare('UPDATE menu SET on = ? WHERE id = ?').run(onVal, id);
    db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('menu_updated', datetime('now'))").run();
    return res.json({ ok: true, id, on: onVal });
  }
  if (onlyOn) {
    const onVal = req.body.on ? 1 : 0;
    db.prepare('UPDATE menu SET on = ? WHERE id = ?').run(onVal, id);
    db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('menu_updated', datetime('now'))").run();
    return res.json({ ok: true, id, on: onVal });
  }
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
    } else if (p.endsWith('index.html') || p.endsWith('install.html') || p.endsWith('manifest.webmanifest') || /\.(svg|css|js)$/i.test(p)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.webp$/i.test(p)) {
      // Фото блюд меняются на месте (одно имя файла), поэтому кэш короче года.
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (/\.(woff2?|png|jpe?g|ico)$/i.test(p)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

/* POST /api/menu/upload — автоматическая Retina WebP нарезка из админки */
app.post('/api/menu/upload', adminGuard, async (req, res) => {
  try {
    const { id, data } = req.body || {};
    if (!data || typeof data !== 'string' || !data.includes(',')) {
      return res.status(400).json({ error: 'Некорректные данные изображения' });
    }
    const cleanId = String(id || ('dish_' + Date.now())).replace(/[^a-zA-Z0-9_-]/g, '_');
    const base64Str = data.split(',')[1].replace(/\s+/g, '');
    const buffer = Buffer.from(base64Str, 'base64');

    const dishesDir = path.resolve('public/media/dishes');
    if (!fs.existsSync(dishesDir)) fs.mkdirSync(dishesDir, { recursive: true });

    const cardFileName = `${cleanId}-card.webp`;
    const zoomFileName = `${cleanId}-zoom.webp`;

    // 1. Компактная карточка 600x600 WebP
    await sharp(buffer)
  .rotate()
  .resize(600, 375, { fit: 'cover', position: 'center' }) // 600 / 1.6 = 375
  .webp({ quality: 80 })
  .toFile(path.join(dishesDir, cardFileName));
      

    // 2. Зум высокого разрешения 1200x1200 WebP
    await sharp(buffer)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(path.join(dishesDir, zoomFileName));

    res.json({ ok: true, url: `/media/dishes/${cardFileName}` });
  } catch (err) {
    console.error('Ошибка upload:', err);
    res.status(500).json({ error: 'Ошибка сохранения изображения' });
  }
});
// ── Автомиграция base64 картинок меню в компактные WebP на диск ──
async function migrateBase64ImagesToWebP() {
  try {
    const dishesDir = path.resolve('public/media/dishes');
    if (!fs.existsSync(dishesDir)) fs.mkdirSync(dishesDir, { recursive: true });

    const rows = db.prepare("SELECT id, img FROM menu WHERE img LIKE 'data:image/%'").all();
    if (!rows.length) return;

    console.log(`[migrate] Найдено ${rows.length} base64-изображений в БД. Конвертируем в WebP...`);
    const updateStmt = db.prepare("UPDATE menu SET img = ? WHERE id = ?");

    for (const r of rows) {
      const cleanId = String(r.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const base64Str = r.img.split(',')[1]?.replace(/\s+/g, '');
      if (!base64Str) continue;

      const buffer = Buffer.from(base64Str, 'base64');
      const cardFile = `${cleanId}-card.webp`;
      const zoomFile = `${cleanId}-zoom.webp`;

      // Нарезка 600x600 WebP для карточки
      await sharp(buffer)
        .rotate()
        .resize(600, 375, { fit: 'cover', position: 'center' }) // 600 / 1.6 = 375
        .webp({ quality: 80 })
        .toFile(path.join(dishesDir, cardFile));

      // Нарезка 1200x1200 WebP для зума
      await sharp(buffer)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(dishesDir, zoomFile));

      const newUrl = `/media/dishes/${cardFile}`;
      updateStmt.run(newUrl, r.id);
    }
    touch();
    console.log('[migrate] Миграция успешно завершена! JSON теперь весит ~5-8 KB.');
  } catch (err) {
    console.error('[migrate] Ошибка миграции изображений:', err);
  }
}
const server = app.listen(PORT, async () => {
  console.log(`☕ ЗЕРНО API запущен на порту ${PORT}`);
  await migrateBase64ImagesToWebP();
  tgEnsureWebhook();
});

process.on('SIGTERM', () => {
  console.log('[srv] SIGTERM, корректно закрываюсь…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
});