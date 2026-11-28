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
import { HOST, PORT, PUBLIC_DIR, SMS_AUTH_ENABLED } from './server/config.js';
import { db } from './server/db/connection.js';
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
import { menuImageForResponse, menuImageSrcsetForResponse } from './server/utils/menu-image.js';

const app = express();

function menuResponseItem(row) {
  const result = item(row);
  result.img = menuImageForResponse(result.img, PUBLIC_DIR);
  result.imgSrcset = menuImageSrcsetForResponse(result.img, PUBLIC_DIR);
  return result;
}
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

const CLIENT_LOG_WINDOW_MS = 60 * 1000;
const CLIENT_LOG_MAX_REQUESTS = 60;
const CLIENT_LOG_MAX_KEYS = 2000;
const clientLogWindows = new Map();

const MAX_MENU_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_MENU_UPLOAD_BASE64_LENGTH = 4 * Math.ceil(MAX_MENU_UPLOAD_BYTES / 3);
const MAX_MENU_UPLOAD_PIXELS = 6_000_000;
const MAX_MENU_UPLOAD_DIMENSION = 4096;

function limitedJsonBody(limit, errorMessage) {
  const parser = express.json({ limit });
  return (req, res, next) => parser(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.status === 413 || error.type === 'entity.too.large';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? errorMessage : 'Некорректный JSON'
    });
  });
}

function clientLogRateLimit(req, res, next) {
  const now = Date.now();
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const previous = clientLogWindows.get(ip);

  if (previous && previous.resetAt > now) {
    if (previous.requests >= CLIENT_LOG_MAX_REQUESTS) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((previous.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Слишком много диагностических запросов. Попробуйте позже.' });
    }
    previous.requests += 1;
    return next();
  }

  if (!previous && clientLogWindows.size >= CLIENT_LOG_MAX_KEYS) {
    for (const [key, entry] of clientLogWindows) {
      if (entry.resetAt <= now) clientLogWindows.delete(key);
    }
    if (clientLogWindows.size >= CLIENT_LOG_MAX_KEYS) {
      let earliestReset = Infinity;
      for (const entry of clientLogWindows.values()) earliestReset = Math.min(earliestReset, entry.resetAt);
      res.set('Retry-After', String(Math.max(1, Math.ceil((earliestReset - now) / 1000))));
      return res.status(429).json({ error: 'Временно достигнут лимит диагностических запросов. Попробуйте позже.' });
    }
  }

  clientLogWindows.set(ip, { requests: 1, resetAt: now + CLIENT_LOG_WINDOW_MS });
  return next();
}

app.post('/api/clientlog',
  clientLogRateLimit,
  limitedJsonBody('4kb', 'Слишком большой запрос диагностических данных'),
  (req, res) => {
    const kind = String((req.body && req.body.kind) || '?').slice(0, 40);
    const msg = String((req.body && req.body.msg) || '').slice(0, 300);
    console.log('[client]', kind, msg);
    res.json({ ok: true });
  }
);

app.post('/api/menu/upload',
  adminGuard,
  limitedJsonBody('6mb', 'Изображение слишком большое'),
  async (req, res) => {
    try {
      const { id, data } = req.body || {};
      const match = typeof data === 'string'
        ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(data)
        : null;
      if (!match) return res.status(400).json({ error: 'Некорректные данные изображения' });

      const mimeType = match[1].toLowerCase();
      const base64 = match[2];
      if (base64.length > MAX_MENU_UPLOAD_BASE64_LENGTH) {
        return res.status(413).json({ error: 'Изображение слишком большое' });
      }
      const buffer = Buffer.from(base64, 'base64');
      if (!buffer.length || buffer.length > MAX_MENU_UPLOAD_BYTES || buffer.toString('base64') !== base64) {
        return res.status(buffer.length > MAX_MENU_UPLOAD_BYTES ? 413 : 400).json({
          error: buffer.length > MAX_MENU_UPLOAD_BYTES ? 'Изображение слишком большое' : 'Некорректные данные изображения'
        });
      }

      const formatByMime = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
      let metadata;
      try {
        metadata = await sharp(buffer, { limitInputPixels: MAX_MENU_UPLOAD_PIXELS }).metadata();
      } catch {
        return res.status(400).json({ error: 'Некорректные данные изображения' });
      }
      if (
        metadata.format !== formatByMime[mimeType] ||
        !metadata.width || !metadata.height ||
        metadata.width > MAX_MENU_UPLOAD_DIMENSION ||
        metadata.height > MAX_MENU_UPLOAD_DIMENSION ||
        metadata.width * metadata.height > MAX_MENU_UPLOAD_PIXELS ||
        metadata.pages > 1
      ) {
        return res.status(400).json({ error: 'Неподдерживаемый формат или размер изображения' });
      }

      const rawId = String(id || ('dish_' + Date.now()));
      if (rawId.length > 128) return res.status(400).json({ error: 'Некорректный идентификатор позиции меню' });
      const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dishesDir = path.resolve(PUBLIC_DIR, 'media/dishes');
      const resizedDir = path.join(dishesDir, 'resized');
      fs.mkdirSync(resizedDir, { recursive: true });

      const cardFileName = cleanId + '-card.webp';
      const zoomFileName = cleanId + '-zoom.webp';
      const sharpOptions = { limitInputPixels: MAX_MENU_UPLOAD_PIXELS };

      await Promise.all([
        sharp(buffer, sharpOptions).rotate().resize(640, 400, { fit: 'cover', position: 'center' })
          .webp({ quality: 84, smartSubsampling: true }).toFile(path.join(dishesDir, cardFileName)),
        sharp(buffer, sharpOptions).rotate().resize(300, 188, { fit: 'cover', position: 'center' })
          .webp({ quality: 78, smartSubsampling: true }).toFile(path.join(resizedDir, cleanId + '-card-300.webp')),
        sharp(buffer, sharpOptions).rotate().resize(600, 375, { fit: 'cover', position: 'center' })
          .webp({ quality: 82, smartSubsampling: true }).toFile(path.join(resizedDir, cleanId + '-card-600.webp'))
      ]);

      await sharp(buffer, sharpOptions)
        .rotate()
        .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, smartSubsampling: true })
        .toFile(path.join(dishesDir, zoomFileName));

      res.json({ ok: true, url: '/media/dishes/' + cardFileName + '?v=' + Date.now() });
    } catch (err) {
      console.error('Ошибка upload:', err);
      res.status(500).json({ error: 'Ошибка сохранения изображения' });
    }
  }
);

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
app.get('/api/config', (req, res) => res.json({
  tgUsername: TG_BOT_USERNAME,
  smsAuthEnabled: SMS_AUTH_ENABLED
}));

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
    // F3.60: наличие кодов сотрудников в окружении (значения не наружу).
    codes_present: {
      admin: /^[A-Za-z0-9_-]{16,64}$/.test(String(process.env.ADMIN_CODE || '').trim()),
      cashier: /^[A-Za-z0-9_-]{16,64}$/.test(String(process.env.CASHIER_CODE || '').trim()),
      dispatch: /^[A-Za-z0-9_-]{16,64}$/.test(String(process.env.DISPATCH_CODE || '').trim()),
    },
  });
});

/* ── меню ── */
app.get('/api/menu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='coffee' ORDER BY sort_order ASC, id ASC").all().map(menuResponseItem),
  updatedAt: getMeta(),
}));
app.get('/api/menu/all', menuGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu ORDER BY sort_order ASC, id ASC').all().map(menuResponseItem),
  updatedAt: getMeta(),
}));
app.get('/api/dmenu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='delivery' ORDER BY sort_order ASC, id ASC").all().map(menuResponseItem),
  updatedAt: getMeta(),
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
    const allowedSection = req.user.role === 'cashier'
      ? 'coffee'
      : (req.user.role === 'dispatch' ? 'delivery' : null);
    if (!allowedSection || (existing.section || 'coffee') !== allowedSection) {
      return res.status(403).json({ error: 'Недостаточно прав для стоп-листа этого меню' });
    }
    const onVal = req.body.on ? 1 : 0;
    db.prepare('UPDATE menu SET is_on = ? WHERE id = ?').run(onVal, id);
    touch();
    return res.json({ ok: true, id, on: onVal });
  }
  if (onlyOn) {
    const onVal = req.body.on ? 1 : 0;
    db.prepare('UPDATE menu SET is_on = ? WHERE id = ?').run(onVal, id);
    touch();
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


// Normalize parser failures from the shared 10 MiB JSON parser.
// Do not expose body-parser messages or the raw request body to API clients.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (!req.path.startsWith('/api/')) return next(error);

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Некорректный JSON',
      code: 'INVALID_JSON'
    });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Тело запроса слишком большое',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  return next(error);
});

/* ── LCP: document-level preload for the explicitly selected brand ── */
app.use((req, res, next) => {
  const isAudit = req.query.lighthouse === '1' || req.query.clean === '1';
  const brand = req.query.brand === 'delivery'
    ? 'delivery'
    : (req.query.brand === 'coffee' || isAudit ? 'coffee' : null);
  if (req.method !== 'GET' || req.path !== '/' || !brand) return next();

  // Preload the first card in the initial visible category, not the first
  // item across every delivery category (sauces/add-ons may sort before pizza).
  const initialCategory = brand === 'delivery' ? 'pizza' : 'coffee';
  const firstMenuImage = db.prepare(
    "SELECT img FROM menu WHERE is_on=1 AND section=? AND cat=? AND img IS NOT NULL AND img != '' ORDER BY sort_order ASC, id ASC LIMIT 1"
  ).get(brand, initialCategory);
  if (!firstMenuImage) return next();

  const image = menuImageForResponse(firstMenuImage.img, PUBLIC_DIR);
  // Only local dish files are eligible: do not put data: or arbitrary external URLs in Link headers.
  if (!image || !image.startsWith('/media/dishes/')) return next();

  const srcset = menuImageSrcsetForResponse(image, PUBLIC_DIR);
  const parameters = [
    '<' + image + '>',
    'rel=preload',
    'as=image',
    'fetchpriority=high'
  ];
  if (srcset) {
    parameters.push('imagesrcset="' + srcset.replace(/"/g, '') + '"');
    parameters.push('imagesizes="(max-width: 519px) calc(100vw - 110px), (max-width: 1180px) 42vw, (max-width: 1599px) 30vw, 23vw"');
  }
  res.setHeader('Link', parameters.join('; '));
  next();
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
      const versioned = /[?&]v=/.test((res.req && res.req.url) || '');
      res.setHeader('Cache-Control', versioned
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=86400');
    } else if (/\.(woff2?|png|jpe?g|ico)$/i.test(p)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

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
      const resizedDir = path.join(dishesDir, 'resized');
      fs.mkdirSync(resizedDir, { recursive: true });

      // Original card plus responsive 300/600 px variants.
      await Promise.all([
        sharp(buffer).rotate().resize(600, 375, { fit: 'cover', position: 'center' })
          .webp({ quality: 80 }).toFile(path.join(dishesDir, cardFile)),
        sharp(buffer).rotate().resize(300, 188, { fit: 'cover', position: 'center' })
          .webp({ quality: 78 }).toFile(path.join(resizedDir, `${cleanId}-card-300.webp`)),
        sharp(buffer).rotate().resize(600, 375, { fit: 'cover', position: 'center' })
          .webp({ quality: 82 }).toFile(path.join(resizedDir, `${cleanId}-card-600.webp`))
      ]);

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
const server = app.listen(PORT, HOST, async () => {
  console.log(`☕ ЗЕРНО API запущен на ${HOST}:${PORT}`);
  await migrateBase64ImagesToWebP();
  tgEnsureWebhook();
});

process.on('SIGTERM', () => {
  console.log('[srv] SIGTERM, корректно закрываюсь…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
});