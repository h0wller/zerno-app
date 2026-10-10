// server/middleware/auth.js
// Модуль 03: authUser и guards. db — из того же места, откуда его берёт server.js
import { db } from '../config.js';

export function authUser(req) {
  const t = (req.header('Authorization') || '').replace('Bearer ', '').trim();
  if (!t) return null;
  const row = db.prepare("SELECT * FROM tokens WHERE token=? AND kind='user'").get(t);
  return row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.ref) : null;
}

function checkRole(req, res, next, allowedRoles, errorMsg = 'Недостаточно прав') {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (allowedRoles && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: errorMsg });
  }
  next();
}

export const userGuard = (req, res, next) => {
  req.user = authUser(req);
  return req.user ? next() : res.status(401).json({ error: 'Нужен вход по номеру' });
};

export const staffGuard = (req, res, next) => {
  return checkRole(req, res, next, ['cashier', 'admin'], 'Недостаточно прав: нужна роль кассира');
};

export const adminGuard = (req, res, next) => {
  return checkRole(req, res, next, ['admin'], 'Недостаточно прав: нужна роль администратора');
};

export const chatGuard = (req, res, next) => {
  return checkRole(req, res, next, ['cashier', 'admin', 'dispatch']);
};

export const pendingGuard = (req, res, next) => {
  return checkRole(req, res, next, ['cashier', 'admin', 'dispatch']);
};

export const dispatchGuard = (req, res, next) => {
  return checkRole(req, res, next, ['cashier', 'admin', 'dispatch']);
};