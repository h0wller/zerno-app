// server/middleware/auth.js
// Модуль 03: authUser и guards. db — из того же места, откуда его берёт server.js
import { db } from '../db/connection.js';

export function getBearerToken(req) {
  const header = String(req.header('Authorization') || '');
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match ? match[1] : '';
}

export function authUser(req) {
  const t = getBearerToken(req);
  if (!t || t.length > 128) return null;
  const row = db.prepare(`
    SELECT ref
    FROM tokens
    WHERE token = ?
      AND kind = 'user'
      AND expires_at > ?
  `).get(t, Date.now());
  return row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.ref) || null : null;
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

export const STAFF_ROLES = Object.freeze(['cashier', 'dispatch', 'admin']);

export const verifiedCustomerGuard = (req, res, next) => {
  req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (Number(req.user.verified) !== 1 && !STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Подтвердите номер телефона или дождитесь активации сотрудником, чтобы оформить заказ.',
      code: 'CUSTOMER_NOT_VERIFIED',
    });
  }
  return next();
};

export const staffGuard = (req, res, next) => checkRole(req, res, next, ['cashier', 'admin'], 'Недостаточно прав: нужна роль кассира');
export const adminGuard = (req, res, next) => checkRole(req, res, next, ['admin'], 'Недостаточно прав: нужна роль администратора');
export const menuGuard = (req, res, next) => checkRole(req, res, next, ['cashier', 'dispatch', 'admin'], 'Недостаточно прав: нужна роль сотрудника');
export const chatGuard = (req, res, next) => checkRole(req, res, next, ['cashier', 'admin', 'dispatch']);
export const pendingGuard = (req, res, next) => checkRole(req, res, next, ['cashier', 'admin', 'dispatch']);
export const dispatchGuard = (req, res, next) => checkRole(req, res, next, ['cashier', 'admin', 'dispatch']);
