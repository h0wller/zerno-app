import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Если путь не передан аргументом, берется C:\Users\<Имя>\Downloads
const defaultDownloads = path.join(os.homedir(), 'Downloads');
const targetPath = process.argv[2] || defaultDownloads;

function stripBase64(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripBase64);
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Удаляем блоки скриншотов Lighthouse
    if (['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot'].includes(key)) {
      continue;
    }
    // Удаляем строковые base64-картинки
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      continue;
    }
    cleaned[key] = stripBase64(value);
  }
  return cleaned;
}

function processFile(filePath) {
  if (!filePath.endsWith('.json') || filePath.endsWith('.clean.json')) return;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);

    // Проверяем наличие структуры отчета Lighthouse
    if (!json.lighthouseVersion && !json.audits) return;

    const cleaned = stripBase64(json);
    const outputPath = filePath.replace(/\.json$/, '.clean.json');

    fs.writeFileSync(outputPath, JSON.stringify(cleaned));

    const originalSize = (Buffer.byteLength(raw) / 1024 / 1024).toFixed(2);
    const newSize = (Buffer.byteLength(JSON.stringify(cleaned)) / 1024 / 1024).toFixed(2);
    console.log(`✓ ${path.basename(filePath)}: ${originalSize}MB -> ${newSize}MB -> ${path.basename(outputPath)}`);
  } catch (err) {
    console.error(`Ошибка при чтении ${filePath}:`, err.message);
  }
}

console.log(`Поиск отчетов в: ${targetPath}`);

if (fs.existsSync(targetPath)) {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.readdirSync(targetPath).forEach(file => processFile(path.join(targetPath, file)));
  } else {
    processFile(targetPath);
  }
  console.log('Готово!');
} else {
  console.error(`Папка не найдена: ${targetPath}`);
}