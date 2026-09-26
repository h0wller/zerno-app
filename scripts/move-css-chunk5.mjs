/* Ф5.8e: cart.js + profile-brand.js (IIFE с явными window-экспортами, пропущены в Ф5.8b)
+ qr.js (не IIFE, шимы drawQR/openQRFull/closeQRFull) → type="module".
cart.js: голые cart/DMENU/promoInfo/deliveryInfo резолвятся в window-свойства
classic-delivery.js (тег 24 < cart 25 — порядок в defer-очереди сохранён).
profile-brand.js: читает/перезаписывает window.renderProfile — допустимо в module.
qr.js: шимы для boot.js (drawQR) и CLOSE-карты overlay.js (window[fn]). */
import fs from 'node:fs';
const IDX = 'public/index.html';
const QR = 'public/app/core/qr.js';

/* qr.js: шимы до смены тега */
let q = fs.readFileSync(QR, 'utf8');
if (!q.includes('window.drawQR =')) {
  q += '\n/* ── Ф5.8e: ESM-шимы: boot renderAll и CLOSE-карта overlay.js ── */\nwindow.drawQR = drawQR;\nwindow.openQRFull = openQRFull;\nwindow.closeQRFull = closeQRFull;\n';
  fs.writeFileSync(QR, q);
  console.log('✅ qr.js: шимы drawQR/openQRFull/closeQRFull');
} else console.log('⚠️ qr.js: шимы уже есть');

let idx = fs.readFileSync(IDX, 'utf8');
const FILES = ['app/cart.js', 'app/profile-brand.js', 'app/core/qr.js'];
for (const rel of FILES) {
  const re = new RegExp('<script([^>]*?)src="([^"]*' + rel.replace(/[./]/g, '\\$&') + ')"([^>]*)>');
  const m = idx.match(re);
  if (!m) { console.log('⚠️ ' + rel + ': тег не найден'); continue; }
  if (/type="module"/.test(m[0])) { console.log('⚠️ ' + rel + ': уже module'); continue; }
  if (!/defer/.test(m[1] + m[3])) { console.log('⚠️ ' + rel + ': без defer — пропуск'); continue; }
  idx = idx.replace(m[0], '<script type="module" src="' + m[2] + '"></script>');
  console.log('✅ ' + rel + ' → type="module"');
}
fs.writeFileSync(IDX, idx);