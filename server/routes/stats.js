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
  const total = db.prepare('SELECT COUNT(*) c FROM customers').get().c;
  const newWeek = db.prepare('SELECT COUNT(*) c FROM customers WHERE created_at>?').get(weekAgo).c;
  const newMonth = db.prepare('SELECT COUNT(*) c FROM customers WHERE created_at>?').get(monthAgo).c;
  const stampsToday = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(ds).c;
  const stampsWeek = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(weekAgo).c;
  const stampsMonth = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(monthAgo).c;
  const redeemed = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE '🎁 Списан%' AND ts>?").get(monthAgo).c;
  const returning = db.prepare('SELECT COUNT(*) c FROM customers WHERE cups>=2').get().c;
  const avgCups = Math.round((db.prepare('SELECT AVG(cups) a FROM customers').get().a||0)*10)/10;
  const promoUses = db.prepare('SELECT COUNT(*) c FROM promo_use').get().c;
  const days = [];
  for (let i=13;i>=0;i--) {
    const d = new Date(Date.now()-i*86400000);
    const start = new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString();
    const end = new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).toISOString();
    days.push({ label: d.getDate()+'.'+(d.getMonth()+1),
      c: db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>=? AND ts<?").get(start,end).c });
  }
  res.json({ total,newWeek,newMonth,stampsToday,stampsWeek,stampsMonth,redeemed,returning,avgCups,promoUses,days });
});

statsRouter.get('/api/stats/redeems', adminGuard, (req, res) => {
  const rows = db.prepare(`
    SELECT a, by, ts FROM history 
    WHERE a LIKE '%списан бесплатный кофе%' 
    ORDER BY id DESC LIMIT 100
  `).all();
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

export default statsRouter;