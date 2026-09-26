/* Ф5.8f: orders.js + cashier.js + profile.js → type="module" (3 файла без IIFE).
Каждому — явные window-шимы на все функции, вызываемые снаружи.
orders.js особый случай: ordersPoll пишется голой переменной из catalog.js (модуль) —
переводим на window-свойство, иначе ReferenceError в setMode. */
import fs from 'node:fs';
const ORDERS = 'public/app/orders.js';
const CASHIER = 'public/app/cashier.js';
const PROFILE = 'public/app/profile.js';
const CATALOG = 'public/app/core/catalog.js';
const IDX = 'public/index.html';

/* ── orders.js ── */
let o = fs.readFileSync(ORDERS, 'utf8');
if (!o.includes('window.ordersPoll')) {
  o = o.replace(/^var ordersPoll\s*=/m, 'window.ordersPoll =');
  console.log('✅ orders.js: ordersPoll → window.ordersPoll');
}
if (!/window\.renderOrders\s*=\s*renderOrders/.test(o)) {
  o += '\n/* ── Ф5.8f: ESM-шим: catalog.js setMode и views.js sv() ── */\nwindow.renderOrders = renderOrders;\n';
  console.log('✅ orders.js: шим renderOrders');
}

/* ── cashier.js ── */
let c = fs.readFileSync(CASHIER, 'utf8');
const cashShims = ['showCust', 'dotsHTML', 'hrow', 'cashierClean'];
const missingShims = cashShims.filter(n => !new RegExp('window\\.' + n + '\\s*=').test(c));
if (missingShims.length) {
  c += '\n/* ── Ф5.8f: ESM-шимы: scanner.js/views.js/cashier-card/admin-extra ── */\n' +
       missingShims.map(n => 'window.' + n + ' = ' + n + ';').join('\n') + '\n';
  console.log('✅ cashier.js: шимы', missingShims.join(', '));
} else console.log('⚠️ cashier.js: шимы уже есть');

/* ── profile.js ── */
let p = fs.readFileSync(PROFILE, 'utf8');
const profShims = ['renderProfile', 'renderBonus', 'loadMyOrders'];
const pMiss = profShims.filter(n => !new RegExp('window\\.' + n + '\\s*=').test(p));
if (pMiss.length) {
  p += '\n/* ── Ф5.8f: ESM-шимы: catalog.js/profile-brand.js/boot.js/live.js ── */\n' +
       pMiss.map(n => 'window.' + n + ' = ' + n + ';').join('\n') + '\n';
  console.log('✅ profile.js: шимы', pMiss.join(', '));
} else console.log('⚠️ profile.js: шимы уже есть');

fs.writeFileSync(ORDERS, o);
fs.writeFileSync(CASHIER, c);
fs.writeFileSync(PROFILE, p);

/* ── catalog.js: голые ordersPoll → window.ordersPoll ── */
let cat = fs.readFileSync(CATALOG, 'utf8');
const re = /(?<![.\w$])ordersPoll(?!\s*:)/g;
const hits = (cat.match(re) || []).length;
if (hits && !/window\.ordersPoll/.test(cat)) {
  cat = cat.replace(re, 'window.ordersPoll');
  fs.writeFileSync(CATALOG, cat);
  console.log('✅ catalog.js:', hits, 'вхождений ordersPoll → window.ordersPoll');
} else console.log('⚠️ catalog.js: ordersPoll уже window или не найден');

/* ── index.html: смена тегов ── */
let idx = fs.readFileSync(IDX, 'utf8');
for (const rel of ['app/orders.js', 'app/cashier.js', 'app/profile.js']) {
  const re = new RegExp('<script([^>]*?)src="([^"]*' + rel.replace(/[./]/g, '\\$&') + ')"([^>]*)>');
  const m = idx.match(re);
  if (!m) { console.log('⚠️ ' + rel + ': тег не найден'); continue; }
  if (/type="module"/.test(m[0])) { console.log('⚠️ ' + rel + ': уже module'); continue; }
  if (!/defer/.test(m[1] + m[3])) { console.log('⚠️ ' + rel + ': без defer'); continue; }
  idx = idx.replace(m[0], '<script type="module" src="' + m[2] + '"></script>');
  console.log('✅ ' + rel + ' → type="module"');
}
fs.writeFileSync(IDX, idx);