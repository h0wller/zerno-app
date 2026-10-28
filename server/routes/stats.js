/* server/routes/stats.js — module-09: статистика владельца */
import { Router } from 'express';
import { db } from '../db/connection.js';
import { adminGuard } from '../middleware/auth.js';

const statsRouter = Router();

statsRouter.get('/api/stats', adminGuard, (req, res) => {
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const ds = dayStart.toISOString();
  const weekAgo = new Date(Date.now()-7*86400000).toISOString();
  const monthAgo = new Date(Date.now()-30*86400000).toISOString();
  // Сотрудники в гостевую статистику не входят — их количество отдаём отдельной строкой.
  const total = db.prepare("SELECT COUNT(*) c FROM customers WHERE role='guest'").get().c;
  const staffCount = db.prepare("SELECT COUNT(*) c FROM customers WHERE role!='guest'").get().c;
  const newWeek = db.prepare("SELECT COUNT(*) c FROM customers WHERE role='guest' AND created_at>?").get(weekAgo).c;
  const newMonth = db.prepare("SELECT COUNT(*) c FROM customers WHERE role='guest' AND created_at>?").get(monthAgo).c;
  const stampsToday = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(ds).c;
  const stampsWeek = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(weekAgo).c;
  const stampsMonth = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(monthAgo).c;
  const redeemed = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE '🎁 Списан%' AND ts>?").get(monthAgo).c;
  const returning = db.prepare("SELECT COUNT(*) c FROM customers WHERE role='guest' AND cups>=2").get().c;
  const avgCups = Math.round((db.prepare("SELECT AVG(cups) a FROM customers WHERE role='guest'").get().a||0)*10)/10;
  const promoUses = db.prepare('SELECT COUNT(*) c FROM promo_use').get().c;
  const days = [];
  for (let i=13;i>=0;i--) {
    const d = new Date(Date.now()-i*86400000);
    const start = new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString();
    const end = new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).toISOString();
    days.push({ label: d.getDate()+'.'+(d.getMonth()+1),
      c: db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>=? AND ts<?").get(start,end).c });
  }
  res.json({ total,staffCount,newWeek,newMonth,stampsToday,stampsWeek,stampsMonth,redeemed,returning,avgCups,promoUses,days });
});

statsRouter.get('/api/stats/redeems', adminGuard, (req, res) => {
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = db.prepare(`
    SELECT a, by, ts FROM history
    WHERE a LIKE '%списан бесплатный кофе%' AND ts > ?
    ORDER BY id DESC
  `).all(monthAgo);
  const stats = {};
  rows.forEach(r => {
    const match = r.a.match(/списан бесплатный кофе: (.+?) \(/);
    const item = match ? match[1] : 'неизвестно';
    stats[item] = (stats[item] || 0) + 1;
  });
  res.json({ 
    total: rows.length, 
    byItem: stats,
    recent: rows.slice(0, 20).map(r => ({
      action: r.a,
      by: r.by,
      time: r.ts
    }))
  });
});

/* ── Заказы «Пятницы» для дашборда: гости и «свои» (сотрудники) раздельно ── */
const klgDay = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kaliningrad' }).format(d); // YYYY-MM-DD

const emptyBucket = () => ({ orders: 0, revenue: 0, avg: 0, cancelled: 0, pickup: 0, delivery: 0, preorders: 0, byStatus: {}, top: [] });

// Treat legacy/normalized cancellation spellings consistently in every statistic.
function isCancelledStatus(status) {
  return ['cancel', 'cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase());
}

function summarize(rows) {
  const b = emptyBucket();
  const top = {};
  for (const o of rows) {
    b.byStatus[o.status] = (b.byStatus[o.status] || 0) + 1;
    if (isCancelledStatus(o.status)) { b.cancelled++; continue; } // отменённые не входят ни в заказы, выручку и топ позиций
    b.orders++;
    b.revenue += o.total || 0;
    if (o.method === 'pickup') b.pickup++; else b.delivery++;
    if (o.is_preorder) b.preorders++;
    for (const i of JSON.parse(o.items || '[]')) top[i.name] = (top[i.name] || 0) + (i.qty || 1);
  }
  b.avg = b.orders ? Math.round(b.revenue / b.orders) : 0;
  // Передаём полный рейтинг каждой группы: обрезка до top-5 здесь ломает общий рейтинг,
  // когда позиции гостей и сотрудников объединяются на клиенте.
  b.top = Object.entries(top).sort((a, c) => c[1] - a[1]).map(([name, qty]) => ({ name, qty }));
  return b;
}

statsRouter.get('/api/stats/orders', adminGuard, (req, res) => {
  const n = Math.max(1, Math.min(30, parseInt(req.query.days, 10) || 14));
  const since = new Date(Date.now() - (n + 1) * 86400000).toISOString();
  const rows = db.prepare('SELECT status, method, is_preorder, total, items, by_staff, created FROM orders WHERE created>?').all(since);

  const today = klgDay(new Date());
  const weekFrom = klgDay(new Date(Date.now() - 6 * 86400000));
  const guest = rows.filter((o) => !o.by_staff);
  const staff = rows.filter((o) => o.by_staff);
  const inRange = (list, from) => list.filter((o) => klgDay(new Date(o.created)) >= from);

  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = klgDay(d);
    const dayRows = rows.filter((o) => klgDay(new Date(o.created)) === key && !isCancelledStatus(o.status));
    const g = dayRows.filter((o) => !o.by_staff);
    days.push({
      label: key.slice(8) + '.' + key.slice(5, 7),
      guest: g.length,
      staff: dayRows.length - g.length,
      revenue: g.reduce((a, o) => a + (o.total || 0), 0),
    });
  }

  res.json({
    today: { guest: summarize(inRange(guest, today)), staff: summarize(inRange(staff, today)) },
    week: { guest: summarize(inRange(guest, weekFrom)), staff: summarize(inRange(staff, weekFrom)) },
    days,
  });
});

export default statsRouter;