import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { join, parse, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..');        // public/media/dishes
const OUT = join(SRC, 'resized');          // public/media/dishes/resized
const SIZES = [300, 600];

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter(f => f.endsWith('-card.webp'));

console.log('found:', files);

for (const f of files) {
  for (const w of SIZES) {
    const { name } = parse(f);
    const outPath = join(OUT, `${name}-${w}.webp`);
    await sharp(join(SRC, f))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(outPath);
    console.log('resized ->', outPath);
  }
}
console.log('done');