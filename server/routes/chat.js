/* server/routes/chat.js — module-08: чат гость ↔ стафф */
import crypto from 'node:crypto';
import { Router } from 'express';
import { db } from '../db/connection.js';
import { authUser, chatGuard } from '../middleware/auth.js';
import { nowISO } from '../utils/id-time.js';
import { sendPush } from '../services/push.js';

const chatRouter = Router();
const MAX_KEY_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 2000;
const RATE_WINDOW_MS = 60 * 1000;

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeHashEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== 64 || right.length !== 64) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function parseGuestKey(value) {
  if (typeof value !== 'string' || value.length > MAX_KEY_LENGTH) return null;
  const customer = value.match(/^(u[a-f0-9]{10}):([cd])$/);
  if (customer) return { key: value, kind: 'customer', ownerId: customer[1], ctx: customer[2] === 'd' ? 'delivery' : 'coffee' };
  const anonymous = value.match(/^(anon-[a-f0-9]{64}):([cd])$/);
  if (anonymous) return { key: value, kind: 'anonymous', ctx: anonymous[2] === 'd' ? 'delivery' : 'coffee' };
  return null;
}

function consumeChatLimit(req, scope, identity, maxRequests, res) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'local');
  const key = digest('chat-rate:v1:' + scope + ':' + ip + ':' + String(identity || '-'));
  const now = Date.now();
  const previous = db.prepare('SELECT requests, window_started_at FROM chat_rate_limits WHERE key=?').get(key);

  if (!previous || now - previous.window_started_at >= RATE_WINDOW_MS) {
    db.prepare(`
      INSERT INTO chat_rate_limits(key, requests, window_started_at) VALUES(?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET requests=1, window_started_at=excluded.window_started_at
    `).run(key, now);
    return true;
  }

  if (previous.requests >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((previous.window_started_at + RATE_WINDOW_MS - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Слишком много запросов к чату. Попробуйте позже.' });
    return false;
  }

  db.prepare('UPDATE chat_rate_limits SET requests=requests+1 WHERE key=?').run(key);
  return true;
}

function applyGuestRateLimits(req, res, scope, key, ipMax, threadMax) {
  if (!consumeChatLimit(req, scope + ':ip', '-', ipMax, res)) return false;
  if (!consumeChatLimit(req, scope + ':thread', key, threadMax, res)) return false;
  db.prepare('DELETE FROM chat_rate_limits WHERE window_started_at < ?').run(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return true;
}

/**
 * Authorizes a customer-owned thread with the current user session.
 * Anonymous threads use a separate 256-bit capability in a header; only its
 * SHA-256 digest is stored. First use claims a fresh random thread key atomically.
 */
function authorizeGuestThread(req, res, key) {
  const parsed = parseGuestKey(key);
  if (!parsed) {
    res.status(400).json({ error: 'Некорректный ключ чата. Откройте чат заново.' });
    return null;
  }

  if (parsed.kind === 'customer') {
    const user = authUser(req);
    if (!user) {
      res.status(401).json({ error: 'Нужен вход для доступа к этому чату' });
      return null;
    }
    if (user.id !== parsed.ownerId) {
      res.status(403).json({ error: 'Нет доступа к этому чату' });
      return null;
    }
    req.user = user;
    return parsed;
  }

  const accessToken = String(req.get('x-chat-access-token') || '');
  if (!/^[a-f0-9]{64}$/.test(accessToken)) {
    res.status(401).json({ error: 'Не найден ключ доступа к анонимному чату. Откройте чат заново.' });
    return null;
  }

  const tokenHash = digest(accessToken);
  db.prepare(
    'INSERT OR IGNORE INTO chat_access(key, token_hash, created_at) VALUES(?, ?, ?)'
  ).run(key, tokenHash, nowISO());
  const stored = db.prepare('SELECT token_hash FROM chat_access WHERE key=?').get(key);
  if (!stored || !safeHashEqual(stored.token_hash, tokenHash)) {
    res.status(403).json({ error: 'Нет доступа к этому чату' });
    return null;
  }
  return parsed;
}

function parseMessage(body) {
  if (!body || typeof body.text !== 'string') return null;
  const text = body.text.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) return null;
  return text;
}

function getStaffThread(req, res, rawKey) {
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!key || key.length > MAX_KEY_LENGTH) {
    res.status(400).json({ error: 'Некорректный ключ чата' });
    return null;
  }

  const meta = db.prepare('SELECT ctx FROM chat_meta WHERE key=?').get(key);
  if (!meta) {
    res.status(404).json({ error: 'Чат не найден' });
    return null;
  }
  const ctx = meta.ctx === 'delivery' ? 'delivery' : 'coffee';
  if ((req.user.role === 'dispatch' && ctx !== 'delivery') || (req.user.role === 'cashier' && ctx !== 'coffee')) {
    res.status(403).json({ error: 'Этот чат ведёт другое заведение' });
    return null;
  }
  return { key, ctx };
}

function pruneThread(key) {
  db.prepare(`
    DELETE FROM chat
    WHERE key=?
      AND id NOT IN (SELECT id FROM chat WHERE key=? ORDER BY id DESC LIMIT 500)
  `).run(key, key);
}

chatRouter.post('/api/chat/send', (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key : '';
  const parsed = parseGuestKey(key);
  if (!parsed) return res.status(400).json({ error: 'Некорректный ключ чата. Откройте чат заново.' });
  if (!applyGuestRateLimits(req, res, 'send', key, 30, 10)) return;

  const authorized = authorizeGuestThread(req, res, key);
  if (!authorized) return;
  const text = parseMessage(req.body);
  if (!text) return res.status(400).json({ error: 'Сообщение должно содержать от 1 до 2000 символов' });

  if (req.body.ctx !== undefined && req.body.ctx !== authorized.ctx) {
    return res.status(400).json({ error: 'Контекст чата не совпадает с ключом' });
  }
  if (req.body.human !== undefined && ![true, false, 0, 1].includes(req.body.human)) {
    return res.status(400).json({ error: 'Некорректный флаг вызова сотрудника' });
  }
  const human = req.body.human === true || req.body.human === 1;
  if (human && authorized.kind !== 'customer') {
    return res.status(403).json({ error: 'Чтобы позвать сотрудника, войдите в профиль' });
  }

  let messageText = text;
  if (human) {
    const last = db.prepare(
      "SELECT text FROM chat WHERE key=? AND who='guest' AND human=0 ORDER BY id DESC LIMIT 1"
    ).get(key);
    if (last?.text) messageText = (last.text + '\\n💬 ' + text).slice(0, MAX_MESSAGE_LENGTH);
  }

  db.prepare('INSERT INTO chat(key,who,text,ts,human,read_s) VALUES(?,?,?,?,?,0)')
    .run(key, 'guest', messageText, nowISO(), human ? 1 : 0);
  db.prepare(`
    INSERT INTO chat_meta(key,closed,ctx) VALUES(?,0,?)
    ON CONFLICT(key) DO UPDATE SET closed=0, ctx=excluded.ctx
  `).run(key, authorized.ctx);
  pruneThread(key);

  if (human) {
    const roles = authorized.ctx === 'delivery' ? "('dispatch','admin')" : "('cashier','admin')";
    const staff = db.prepare(`SELECT id FROM customers WHERE role IN ${roles}`).all();
    const base = process.env.APP_URL || 'https://friday.andcoffee.online';
    const kb = {
      inline_keyboard: [[{
        text: '💬 Открыть обращение',
        web_app: { url: base + '/?src=tg&brand=' + authorized.ctx + '&staffChat=' + encodeURIComponent(key) }
      }]]
    };
    for (const person of staff) {
      Promise.resolve(sendPush(
        person.id,
        authorized.ctx === 'delivery' ? '💬 Вопрос по доставке' : '💬 Вопрос по кофейне',
        messageText.slice(0, 200),
        kb
      )).catch(() => {});
    }
  }
  res.json({ ok: true });
});

chatRouter.post('/api/chat/botlog', (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key : '';
  if (!parseGuestKey(key)) return res.status(400).json({ error: 'Некорректный ключ чата' });
  if (!db.prepare('SELECT 1 FROM chat_meta WHERE key=?').get(key)) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  if (!applyGuestRateLimits(req, res, 'botlog', key, 60, 20)) return;

  const authorized = authorizeGuestThread(req, res, key);
  if (!authorized) return;
  const text = parseMessage(req.body);
  if (!text) return res.status(400).json({ error: 'Сообщение должно содержать от 1 до 2000 символов' });

  db.prepare('INSERT INTO chat(key,who,text,ts,read_s) VALUES(?,?,?,?,0)')
    .run(key, 'bot', text, nowISO());
  pruneThread(key);
  res.json({ ok: true });
});

chatRouter.get('/api/chat/thread', (req, res) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  if (!parseGuestKey(key)) return res.status(400).json({ error: 'Некорректный ключ чата' });
  if (!db.prepare('SELECT 1 FROM chat_meta WHERE key=?').get(key)) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  if (!applyGuestRateLimits(req, res, 'thread', key, 120, 60)) return;

  const authorized = authorizeGuestThread(req, res, key);
  if (!authorized) return;

  const after = req.query.after === undefined ? 0 : Number(req.query.after);
  if (!Number.isSafeInteger(after) || after < 0) {
    return res.status(400).json({ error: 'Некорректный курсор чата' });
  }
  const msgs = db.prepare(`
    SELECT id,who,text,ts FROM chat
    WHERE key=? AND id>?
    ORDER BY id ASC
    LIMIT 100
  `).all(key, after);
  res.json({ msgs });
});

chatRouter.get('/api/chat/list', chatGuard, (req, res) => {
  const showClosed = req.query.closed === '1';
  const role = req.user.role;
  const rows = db.prepare(`
    SELECT c.key, MAX(c.id) mid,
      SUM(CASE WHEN c.who='guest' AND c.read_s=0 THEN 1 ELSE 0 END) unread,
      IFNULL(m.closed,0) closed, IFNULL(m.staff_in,0) staff_in, IFNULL(m.ctx,'coffee') ctx,
      MAX(CASE WHEN c.who='guest' AND c.human=1 THEN 1 ELSE 0 END) human,
      MAX(CASE WHEN c.who='guest' AND c.human=1 THEN c.id END) callId,
      MAX(c.ts) lastTs
    FROM chat c LEFT JOIN chat_meta m ON m.key=c.key
    GROUP BY c.key ORDER BY mid DESC LIMIT 50
  `).all();
  const prevStmt = db.prepare("SELECT text FROM chat WHERE key=? AND who='guest' AND human=0 AND id<? ORDER BY id DESC LIMIT 1");
  const callStmt = db.prepare('SELECT ts FROM chat WHERE id=?');
  const threads = rows
    .filter(row => role === 'dispatch' ? row.ctx === 'delivery' : role === 'cashier' ? row.ctx === 'coffee' : true)
    .filter(row => showClosed ? row.closed : (!row.closed && (row.human || row.staff_in)))
    .map(row => {
      const customerId = row.key.replace(/:[cd]$/, '');
      const customer = db.prepare('SELECT name FROM customers WHERE id=?').get(customerId);
      const callTs = row.callId ? ((callStmt.get(row.callId) || {}).ts || '') : '';
      const prev = row.callId ? prevStmt.get(row.key, row.callId) : null;
      const lastGuest = prev?.text ? String(prev.text).split('\\n💬 ').pop().slice(0, 140) : '';
      return {
        key: row.key,
        name: customer ? customer.name : 'Гость',
        unread: row.unread,
        human: row.human,
        ctx: row.ctx,
        callTs,
        lastGuest,
        lastTs: row.lastTs || ''
      };
    });
  threads.sort((a, b) => {
    if (a.human !== b.human) return b.human - a.human;
    if (a.human) return String(a.callTs).localeCompare(String(b.callTs));
    return String(b.lastTs).localeCompare(String(a.lastTs));
  });
  res.json({ threads });
});

chatRouter.get('/api/chat/dialog', chatGuard, (req, res) => {
  const thread = getStaffThread(req, res, req.query.key);
  if (!thread) return;
  db.prepare("UPDATE chat SET read_s=1 WHERE key=? AND who='guest'").run(thread.key);

  const meta = db.prepare('SELECT staff_in FROM chat_meta WHERE key=?').get(thread.key);
  if (!meta.staff_in) {
    db.prepare('UPDATE chat_meta SET staff_in=1 WHERE key=?').run(thread.key);
    db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)')
      .run(thread.key, 'system', '👋 Сотрудник подключился к чату — бот Ника отдыхает', nowISO());
    pruneThread(thread.key);
  }
  const msgs = db.prepare(`
    SELECT id,who,text,ts FROM (
      SELECT id,who,text,ts FROM chat WHERE key=? ORDER BY id DESC LIMIT 200
    ) ORDER BY id ASC
  `).all(thread.key);
  res.json({ msgs });
});

chatRouter.post('/api/chat/reply', chatGuard, (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key : '';
  const text = parseMessage(req.body);
  if (!text) return res.status(400).json({ error: 'Сообщение должно содержать от 1 до 2000 символов' });
  const thread = getStaffThread(req, res, key);
  if (!thread) return;

  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)')
    .run(thread.key, 'staff', text, nowISO());
  pruneThread(thread.key);

  const customerKey = thread.key.match(/^(u[a-f0-9]{10}):[cd]$/);
  if (customerKey) {
    Promise.resolve(sendPush(
      customerKey[1],
      thread.ctx === 'delivery' ? '💬 Ответ поддержки «Пятница»' : '💬 Вам ответили из «…и кофе»',
      text.slice(0, 80)
    )).catch(() => {});
  }
  res.json({ ok: true });
});

chatRouter.post('/api/chat/close', chatGuard, (req, res) => {
  const thread = getStaffThread(req, res, req.body?.key);
  if (!thread) return;

  db.prepare('UPDATE chat_meta SET closed=1, staff_in=0 WHERE key=?').run(thread.key);
  db.prepare("UPDATE chat SET human=0, read_s=1 WHERE key=? AND who='guest'").run(thread.key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)')
    .run(thread.key, 'system', '✅ Чат закрыт. Бот Ника снова на связи.', nowISO());
  pruneThread(thread.key);
  res.json({ ok: true });
});

chatRouter.post('/api/chat/open', chatGuard, (req, res) => {
  const thread = getStaffThread(req, res, req.body?.key);
  if (!thread) return;
  db.prepare('UPDATE chat_meta SET closed=0 WHERE key=?').run(thread.key);
  res.json({ ok: true });
});

export default chatRouter;
