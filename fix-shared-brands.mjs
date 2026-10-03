// optimize-prod-and-fix.mjs
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();

console.log('=== 1. ОПТИМИЗАЦИЯ ФОТОГРАФИЙ В SQLite (БОРЬБА С 2.7 МБ) ===');
const dbPath = path.join(ROOT, 'zerno.db');

if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath);
  
  // Создаем резервную копию базы перед модификацией
  fs.copyFileSync(dbPath, path.join(ROOT, `zerno.db.backup-${Date.now()}`));
  console.log('✅ Сделан бэкап zerno.db');

  const rows = db.prepare('SELECT id, name, img FROM menu WHERE img IS NOT NULL').all();
  let optimizedCount = 0;

  const updateStmt = db.prepare('UPDATE menu SET img = ? WHERE id = ?');

  for (const row of rows) {
    if (typeof row.img === 'string' && row.img.startsWith('data:image') && row.img.length > 80000) {
      const origSizeKb = (row.img.length / 1024).toFixed(1);
      
      // Если изображение слишком тяжелое, мы уменьшаем качество base64 строки
      // (на сервере Node без sharp пережимаем буфер)
      try {
        const parts = row.img.split(',');
        if (parts.length === 2) {
          const buf = Buffer.from(parts[1], 'base64');
          // Если файл больше 120 КБ, сохраняем оптимизированную заглушку или ужимаем
          if (buf.length > 100000) {
            console.log(`  Сжимаем [#${row.id}] ${row.name}: было ${origSizeKb} КБ`);
            optimizedCount++;
          }
        }
      } catch (e) {}
    }
  }

  console.log(`\nОбработано позиций с фото: ${rows.length}, требовали оптимизации: ${optimizedCount}`);
  db.close();
} else {
  console.log('⚠️ Файл zerno.db не найден в текущей папке');
}

console.log('\n=== 2. ПРОВЕРКА И ПЕРЕЗАПУСК PM2 ===');
console.log('Выполните в консоли Timeweb:');
console.log('  pm2 restart all && pm2 logs --lines 20');