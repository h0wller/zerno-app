/* server/routes/chat.js — module-08: чат гость ↔ стафф */
import { Router } from 'express';
import { db } from '../db/connection.js';
import { authUser, chatGuard } from '../middleware/auth.js';
import { nowISO } from '../utils/id-time.js';
import { sendPush } from '../services/push.js';

const chatRouter = Router();
const MAX_CHAT_KEY_LENGTH = 80;
const MESSAGE_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_OWNER = 15;
const MAX_MESSAGES_PER_IP = 120;
const HUMAN_CALL_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_HUMAN_CALLS_PER_IP = 5;
const ipBuckets = new Map();
const messageBuckets = new Map();
const humanCallBuckets = new Map();
const humanIpBuckets = new Map();

function pruneBuckets(map, now) {
  if (map.size <= 10000) return;
  for (const [key, entry] of map) {
    if (entry.expiresAt <= now) map.delete(key);
  }
  while (map.size > 9000) {
    map.delete(map.keys().next().value);
  }
}

function consumeLimit(map, key, max, windowMs) {
  const now = Date.now();
  let bucket = map.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    bucket = { count: 0, expiresAt: now + windowMs };
    map.set(key, bucket);
  }
  if (bucket.count >= max) {
    return Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
  }
  bucket.count += 1;
  pruneBuckets(map, now);
  return 0;
}

function sendRateLimit(res, retryAfter, message) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({ error: message, retryAfter });
}

function parseGuestKey(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_CHAT_KEY_LENGTH) return null;
  const match = /^(.+):([cd])$/.exec(value);
  if (!match) return null;

  const base = match[1];
  const ctx = match[2] === 'd' ? 'delivery' : 'coffee';
  if (/^anon-[a-f0-9]{64}$/.test(base)) {
    return { key: value, base, ctx, anonymous: true };
  }
  return { key: value, base, ctx, anonymous: false };
}

function requireGuestThread(req, res, rawKey) {
  const parsed = parseGuestKey(rawKey);
  if (!parsed) {
    res.status(401).json({ error: 'Нужен действующий ключ чата или вход в профиль' });
    return null;
  }

  if (parsed.anonymous) {
    return { ...parsed, user: null, actorKey: 'anon:' + parsed.key };
  }

  const user = authUser(req);
  if (!user) {
    res.status(401).json({ error: 'Нужен вход в профиль для доступа к этому чату' });
    return null;
  }
  if (String(user.id) !== parsed.base) {
    res.status(403).json({ error: 'Нет доступа к этому чату' });
    return null;
  }
  return { ...parsed, user, actorKey: 'user:' + user.id };
}

function requireStaffThread(req, res, rawKey) {
  const key = typeof rawKey === 'string' ? rawKey : '';
  if (!key || key.length > MAX_CHAT_KEY_LENGTH) {
    res.status(400).json({ error: 'Укажите корректный ключ чата' });
    return null;
  }

  const meta = db.prepare('SELECT ctx FROM chat_meta WHERE key=?').get(key);
  const hasMessages = db.prepare('SELECT 1 FROM chat WHERE key=? LIMIT 1').get(key);
  if (!meta || !hasMessages) {
    res.status(404).json({ error: 'Чат не найден' });
    return null;
  }

  const ctx = meta.ctx === 'delivery' ? 'delivery' : 'coffee';
  const keyCtx = key.endsWith(':d') ? 'delivery' : key.endsWith(':c') ? 'coffee' : null;
  if (
    (req.user.role === 'dispatch' && ctx !== 'delivery') ||
    (req.user.role === 'cashier' && ctx !== 'coffee') ||
    (keyCtx && keyCtx !== ctx)
  ) {
    res.status(403).json({ error: 'Этот чат ведёт другое заведение' });
    return null;
  }
  return { key, ctx };
}

chatRouter.post('/api/chat/send', (req, res) => {
  const access = requireGuestThread(req, res, String(req.body?.key ?? ''));
  if (!access) return;

  let text = String(req.body?.text ?? '').slice(0, 2000);
  if (!text.trim()) return res.status(400).json({ error: 'bad request' });

  const humanValue = req.body?.human;
  if (![undefined, null, false, 0, 1, true].includes(humanValue)) {
    return res.status(400).json({ error: 'Некорректный флаг вызова сотрудника' });
  }
  const human = humanValue === 1 || humanValue === true;
  const ipWait = consumeLimit(
    ipBuckets,
    req.ip || req.socket?.remoteAddress || 'local',
    MAX_MESSAGES_PER_IP,
    MESSAGE_WINDOW_MS
  );
  if (ipWait > 0) {
    return sendRateLimit(res, ipWait, 'Слишком много запросов с этого адреса. Попробуйте позже.');
  }

  const messageWait = consumeLimit(
    messageBuckets,
    access.actorKey,
    MAX_MESSAGES_PER_OWNER,
    MESSAGE_WINDOW_MS
  );
  if (messageWait > 0) {
    return sendRateLimit(res, messageWait, 'Слишком много сообщений. Попробуйте позже.');
  }

  if (human) {
    const callWait = consumeLimit(
      humanCallBuckets,
      access.actorKey,
      1,
      HUMAN_CALL_COOLDOWN_MS
    );
    if (callWait > 0) {
      return sendRateLimit(res, callWait, 'Вы уже вызвали сотрудника. Повторите позже.');
    }

    const ipCallWait = consumeLimit(
      humanIpBuckets,
      req.ip || req.socket?.remoteAddress || 'local',
      MAX_HUMAN_CALLS_PER_IP,
      MESSAGE_WINDOW_MS
    );
    if (ipCallWait > 0) {
      return sendRateLimit(res, ipCallWait, 'С этого адреса слишком часто вызывают сотрудников. Попробуйте позже.');
    }

    const last = db.prepare(
      "SELECT text FROM chat WHERE key=? AND who='guest' AND human=0 ORDER BY id DESC LIMIT 1"
    ).get(access.key);
    if (last && last.text) text = last.text + '\n💬 ' + text;
  }

  db.prepare('INSERT INTO chat(key,who,text,ts,human,read_s) VALUES(?,?,?,?,?,0)')
    .run(access.key, 'guest', text, nowISO(), human ? 1 : 0);
  db.prepare(
    "INSERT INTO chat_meta(key,closed,ctx) VALUES(?,0,?) ON CONFLICT(key) DO UPDATE SET closed=0, ctx=excluded.ctx"
  ).run(access.key, access.ctx);

  if (human) {
    const roles = access.ctx === 'delivery' ? "('dispatch','admin')" : "('cashier','admin')";
    const staff = db.prepare(`SELECT id FROM customers WHERE role IN ${roles}`).all();
    const base = process.env.APP_URL || 'https://friday.andcoffee.online';
    const kb = {
      inline_keyboard: [[{
        text: '💬 Открыть обращение',
        web_app: { url: base + '/?src=tg&brand=' + access.ctx + '&staffChat=' + encodeURIComponent(access.key) }
      }]]
    };
    for (const member of staff) {
      sendPush(
        member.id,
        access.ctx === 'delivery' ? '💬 Вопрос по доставке' : '💬 Вопрос по кофейне',
        text.slice(0, 200),
        kb
      ).catch(() => {});
    }
  }
  res.json({ ok: true });
});

chatRouter.get('/api/chat/thread', (req, res) => {
  const access = requireGuestThread(req, res, String(req.query.key ?? ''));
  if (!access) return;

  const afterRaw = req.query.after === undefined ? '0' : req.query.after;
  const after = Number(afterRaw);
  if (!Number.isSafeInteger(after) || after < 0) {
    return res.status(400).json({ error: 'Некорректный ID последнего сообщения' });
  }
  res.json({
    msgs: db.prepare('SELECT id,who,text,ts FROM chat WHERE key=? AND id>? ORDER BY id')
      .all(access.key, after)
  });
});

chatRouter.get('/api/chat/list', chatGuard, (req, res) => {
  const showClosed = req.query.closed === '1';
  const role = req.user.role;
  const rows = db.prepare(`SELECT c.key, MAX(c.id) mid,
    SUM(CASE WHEN c.who='guest' AND c.read_s=0 THEN 1 ELSE 0 END) unread,
    IFNULL(m.closed,0) closed, IFNULL(m.staff_in,0) staff_in, IFNULL(m.ctx,'coffee') ctx,
    MAX(CASE WHEN c.who='guest' AND c.human=1 THEN 1 ELSE 0 END) human,
    MAX(CASE WHEN c.who='guest' AND c.human=1 THEN c.id END) callId,
    MAX(c.ts) lastTs
    FROM chat c LEFT JOIN chat_meta m ON m.key=c.key
    GROUP BY c.key ORDER BY mid DESC LIMIT 50`).all();
  const prevStmt = db.prepare("SELECT text FROM chat WHERE key=? AND who='guest' AND human=0 AND id<? ORDER BY id DESC LIMIT 1");
  const callStmt = db.prepare('SELECT ts FROM chat WHERE id=?');
  const threads = rows
    .filter(r => role === 'dispatch' ? r.ctx === 'delivery' : role === 'cashier' ? r.ctx === 'coffee' : true)
    .filter(r => showClosed ? r.closed : (!r.closed && (r.human || r.staff_in)))
    .map(r => {
      const c = db.prepare('SELECT name FROM customers WHERE id=?').get(r.key.replace(/:[cd]$/, ''));
      const callTs = r.callId ? ((callStmt.get(r.callId) || {}).ts || '') : '';
      // Последнее сообщение гостя перед вызовом сотрудника (без склейки с текстом вызова).
      const prev = r.callId ? prevStmt.get(r.key, r.callId) : null;
      const lastGuest = prev && prev.text ? String(prev.text).split('\n💬 ').pop().slice(0, 140) : '';
      return {
        key: r.key, name: c ? c.name : 'Гость', unread: r.unread, human: r.human, ctx: r.ctx,
        callTs, lastGuest, lastTs: r.lastTs || '',
      };
    });
  // Ожидающие вызовы сверху (дольше ждущие — первыми), остальные — по свежести.
  threads.sort((a, b) => {
    if (a.human !== b.human) return b.human - a.human;
    if (a.human) return String(a.callTs).localeCompare(String(b.callTs));
    return String(b.lastTs).localeCompare(String(a.lastTs));
  });
  res.json({ threads });
});

chatRouter.get('/api/chat/dialog', chatGuard, (req, res) => {
  const thread = requireStaffThread(req, res, String(req.query.key ?? ''));
  if (!thread) return;

  db.prepare("UPDATE chat SET read_s=1 WHERE key=? AND who='guest'").run(thread.key);
  const meta = db.prepare('SELECT staff_in FROM chat_meta WHERE key=?').get(thread.key);
  if (!meta.staff_in) {
    db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,0,1) ON CONFLICT(key) DO UPDATE SET staff_in=1')
      .run(thread.key);
    db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)')
      .run(thread.key, 'system', '👋 Сотрудник подключился к чату — бот Ника отдыхает', nowISO());
  }
  res.json({
    msgs: db.prepare('SELECT id,who,text,ts FROM chat WHERE key=? ORDER BY id').all(thread.key)
  });
});

chatRouter.post('/api/chat/reply', chatGuard, (req, res) => {
  const key = String(req.body?.key ?? '');
  const text = String(req.body?.text ?? '').slice(0, 2000);
  if (!text.trim()) return res.status(400).json({ error: 'bad request' });
  const thread = requireStaffThread(req, res, key);
  if (!thread) return;

  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)')
    .run(thread.key, 'staff', text, nowISO());
  const customerId = thread.key.replace(/:[cd]$/, '');
  if (!customerId.startsWith('anon-')) {
    sendPush(
      customerId,
      thread.ctx === 'delivery' ? '💬 Ответ поддержки «Пятница»' : '💬 Вам ответили из «…и кофе»',
      text.slice(0, 80)
    ).catch(() => {});
  }
  res.json({ ok: true });
});

chatRouter.post('/api/chat/close', chatGuard, (req, res) => {
  const key = String(req.body?.key ?? '');
  const thread = requireStaffThread(req, res, key);
  if (!thread) return;

  db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,1,0) ON CONFLICT(key) DO UPDATE SET closed=1, staff_in=0')
    .run(thread.key);
  db.prepare("UPDATE chat SET human=0, read_s=1 WHERE key=? AND who='guest'").run(thread.key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)')
    .run(thread.key, 'system', '✅ Чат закрыт. Бот Ника снова на связи.', nowISO());
  res.json({ ok: true });
});

chatRouter.post('/api/chat/open', chatGuard, (req, res) => {
  const key = String(req.body?.key ?? '');
  const thread = requireStaffThread(req, res, key);
  if (!thread) return;

  db.prepare('INSERT INTO chat_meta(key,closed) VALUES(?,0) ON CONFLICT(key) DO UPDATE SET closed=0')
    .run(thread.key);
  res.json({ ok: true });
});

export default chatRouter;
