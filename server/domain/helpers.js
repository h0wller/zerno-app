import crypto from 'crypto';
import { db } from '../db/connection.js';
import { nowISO } from '../utils/id-time.js';

export const item = r => ({ id: r.id, cat: r.cat, e: r.e, name: r.name, desc: r.descr,
  comp: JSON.parse(r.comp || '[]'), vol: r.vol, price: r.price, tag: r.tag,
  coffee: r.coffee, on: r.is_on, img: r.img, section: r.section || 'coffee', opts: JSON.parse(r.opts || '[]') });

export const cust = c => ({ 
  id: c.id, name: c.name, phone: c.phone, stamps: c.stamps, free: c.free,
  cups: c.cups, qr: c.qr, role: c.role || 'guest', 
  verified: c.verified ? 1 : 0, welcome: c.welcome ? 1 : 0,
  tg: c.tg ? 1 : 0, 
  notify_tg: c.notify_tg !== 0 ? 1 : 0, 
  notify_web: c.notify_web !== 0 ? 1 : 0,
  history: db.prepare('SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10').all(c.id) 
});

export const addHist = (cid, a, by) => db.prepare('INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)').run(cid, nowISO(), a, by);

export const logEv = (w, a) => { 
  const d = new Date(); 
  const pad = n => String(n).padStart(2, '0');
  db.prepare('INSERT INTO events(t,w,a) VALUES(?,?,?)')
    .run(`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`, w, a); 
};

export const getMeta = () => db.prepare("SELECT value FROM meta WHERE key='updatedAt'").get()?.value || nowISO();

export const touch = () => db.prepare("INSERT INTO meta(key,value) VALUES('updatedAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(nowISO());

export const issueToken = ref => { 
  const t = crypto.randomUUID();
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)').run(t, 'user', ref, nowISO()); 
  return t; 
};