/* Пакет C-fix: cart-regress — после степперного «−» (qty 2→1) в корзине остаётся qty 1:
для опустошения нужен ОДИН минус-клик, второй ждал кнопку на пустой корзине → таймаут. */
import fs from 'node:fs';
const CR = 'tests/cart-regress.spec.js';
let c = fs.readFileSync(CR, 'utf8');
const dup = "  await page.locator('#cartItems [data-act=\"-\"]').first().click();\n" +
            "  await page.locator('#cartItems [data-act=\"-\"]').first().click();\n";
const single = "  await page.locator('#cartItems [data-act=\"-\"]').first().click(); /* qty 1→0: карточный «−» уже снял один (Ф5.23) */\n";
if (c.includes(dup)) { c = c.replace(dup, single); fs.writeFileSync(CR, c); console.log('✅ cart-regress: дубль минус-клика убран'); }
else if (c.includes(single)) console.log('⚠️ cart-regress: уже исправлен');
else { console.error('❌ cart-regress: дубль не найден — покажи строки 30–40'); process.exit(1); }