// server/middleware/auth.js
// Модуль 03: authUser и guards. db — из того же места, откуда его берёт server.js
import { db } from '../config.js';

export function authUser(req) {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  const row = db.prepare("SELECT * FROM tokens WHERE token=? AND kind='user'").get(t);
  return row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.ref) : null;
}

export const userGuard = (req, res, next) => {
  req.user = authUser(req);
  req.user ? next() : res.status(401).json({ error: 'Нужен вход по номеру' });
};

export const staffGuard = (req, res, next) => {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (req.user.role !== 'cashier' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Недостаточно прав: нужна роль кассира' });
  next();
};

export const chatGuard = (req, res, next) => {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (!['cashier', 'admin', 'dispatch'].includes(req.user.role))
    return res.status(403).json({ error: 'Недостаточно прав' });
  next();
};

export const adminGuard = (req, res, next) => {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Недостаточно прав: нужна роль администратора' });
  next();
};

export const pendingGuard = (req, res, next) => {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (!['cashier', 'admin', 'dispatch'].includes(req.user.role))
    return res.status(403).json({ error: 'Недостаточно прав' });
  next();
};

export const dispatchGuard = (req, res, next) => {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (!['cashier', 'admin', 'dispatch'].includes(req.user.role))
    return res.status(403).json({ error: 'Недостаточно прав' });
  next();
};