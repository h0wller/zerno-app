/* Ф5.21c: убираем дубль мутаций корзины: 1 клик = +2 (qty 1→3).
delivery.js #cartItems и cart.js #cartPanel оба мутировали cart[i].qty на одном клике
(target + bubble). Мутации и save остаются ТОЛЬКО в cart.js (cPanel);
из delivery.js цепочка qty удалена. syncAddButtons гарантируем из cart.js после рендера.
Побочный эффект фикса: уходит корень TypeError Ф5.21 (splice + протухший индекс во втором обработчике). */
import fs from 'node:fs';
const DEL = 'public/app/delivery.js';
const CART = 'public/app/cart.js';

/* 1) delivery.js: вырезаем цепочку мутаций (минифицированная и проставленная формы) */
let d = fs.readFileSync(DEL, 'utf8');
const reMut = /if \(b\.dataset\.act === '\+'\) cart\[i\]\.qty\+\+;\s*else if \(cart\[i\]\.qty > 1\) cart\[i\]\.qty--;\s*else cart\.splice\(i, 1\);/;
if (reMut.test(d)) {
  d = d.replace(reMut, '/* Ф5.21c: qty-мутации и save ведёт cart.js (cPanel); дубль убран */');
  fs.writeFileSync(DEL, d);
  console.log('✅ delivery.js: цепочка qty-мутаций удалена из #cartItems-слушателя');
} else if (d.includes('Ф5.21c: qty-мутации')) {
  console.log('⚠️ delivery.js: уже удалена');
} else {
  console.error('❌ delivery.js: цепочка мутаций не найдена — покажи тело слушателя #cartItems');
  process.exit(1);
}

/* 2) cart.js: syncAddButtons после рендера в cPanel-обработчике (если ещё нет) */
let c = fs.readFileSync(CART, 'utf8');
if (!/syncAddButtons/.test(c)) {
  const reChain = /(var it = cart\[i\];[\s\S]{0,400}?renderCartBase\(\);)/;
  if (!reChain.test(c)) { console.error('❌ cart.js: цепочка cPanel-обработчика не найдена'); process.exit(1); }
  c = c.replace(reChain, '$1\n      if (typeof window.syncAddButtons === "function") window.syncAddButtons(); /* Ф5.21c */');
  fs.writeFileSync(CART, c);
  console.log('✅ cart.js: syncAddButtons после renderCartBase в cPanel-обработчике');
} else console.log('⚠️ cart.js: syncAddButtons уже вызывается');

/* 3) контроль: мутация qty осталась ровно в одном файле */
const cnt = (c.match(/cart\[i\]\.qty\+\+/g) || []).length + (d.match(/cart\[i\]\.qty\+\+/g) || []).length;
console.log(cnt === 1 ? '✅ мутация qty единственная (cart.js)' : '❌ мутаций qty: ' + cnt + ' — проверь вручную');
if (cnt !== 1) process.exit(1);