/* scripts/fix-duplicate-images.mjs */
import Database from 'better-sqlite3';

const db = new Database('zerno.db');

// 1. Находим картинки, которые привязаны сразу к нескольким блюдам
const dupes = db.prepare(`
  SELECT img, COUNT(*) as count 
  FROM menu 
  WHERE img != '' AND img IS NOT NULL 
  GROUP BY img 
  HAVING count > 1
`).all();

console.log(`Найдено картинок-дубликатов: ${dupes.length}`);

for (const d of dupes) {
  const items = db.prepare("SELECT id, name, cat FROM menu WHERE img = ?").all(d.img);
  console.log(`\nКартинка ${d.img} висит на:`, items.map(x => `${x.name} (${x.cat})`).join(', '));

  // Если одна и та же картинка на допе/соусе и на ролле/пицце — с ролла/пиццы её снимаем
  const hasAddon = items.some(x => x.cat === 'sauces');
  if (hasAddon) {
    for (const it of items) {
      if (it.cat !== 'sauces') {
        db.prepare("UPDATE menu SET img = '' WHERE id = ?").run(it.id);
        console.log(`  ✓ Снята ошибочная картинка с «${it.name}»`);
      }
    }
  }
}

// 2. Показываем, у каких блюд доставки сейчас нет фото
const missing = db.prepare("SELECT id, name, cat FROM menu WHERE section='delivery' AND (img = '' OR img IS NULL) ORDER BY cat").all();
console.log(`\n📋 Осталось без фото (${missing.length} шт.):`);
missing.forEach(m => console.log(`- [${m.cat}] ${m.name} (ID: ${m.id})`));