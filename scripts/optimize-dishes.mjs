/* scripts/optimize-dishes.mjs — оптимизация изображений блюд */
import fs from 'node:fs';

const file = 'public/app/ui/theme-v2.css';
let css = fs.readFileSync(file, 'utf8');

// Старый блок, дублирующий новые стили
const oldBlockRegex = /\/\* ── Фаза 4,[\s\S]*?\.cartPanel\{[\s\S]*?\.checkoutForm textarea\{[\s\S]*?\}\s*\}/;

if (oldBlockRegex.test(css)) {
  css = css.replace(oldBlockRegex, '/* ── Корзина вынесена в конец файла ── */');
  fs.writeFileSync(file, css, 'utf8');
  console.log('✅ Устаревший дубль стилей корзины удалён из theme-v2.css');
} else {
  console.log('ℹ️ Дубликатов не найдено.');
}