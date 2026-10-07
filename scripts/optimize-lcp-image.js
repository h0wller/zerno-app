import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, '..', 'public', 'media', 'dishes', '1-card.webp');
const outputPath = path.join(__dirname, '..', 'public', 'media', 'dishes', '1-card-optimized.webp');

async function optimize() {
  try {
    if (!fs.existsSync(inputPath)) {
      console.error('❌ Файл не найден:', inputPath);
      console.log('Проверьте путь к изображению в public/media/dishes/');
      process.exit(1);
    }

    const beforeStats = fs.statSync(inputPath);
    const beforeSize = (beforeStats.size / 1024).toFixed(1);

    console.log(`📊 Исходный размер: ${beforeSize} KB`);

    await sharp(inputPath)
      .webp({ quality: 75 })
      .toFile(outputPath);

    const afterStats = fs.statSync(outputPath);
    const afterSize = (afterStats.size / 1024).toFixed(1);
    const savings = ((1 - afterStats.size / beforeStats.size) * 100).toFixed(1);

    console.log(`✅ Оптимизированный размер: ${afterSize} KB`);
    console.log(`🎯 Экономия: ${savings}% (${(beforeSize - afterSize).toFixed(1)} KB)`);
    console.log(`\n📝 Следующий шаг: замените оригинал`);
    console.log(`   copy public\\media\\dishes\\1-card-optimized.webp public\\media\\dishes\\1-card.webp`);

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  }
}

optimize();