import fs from 'node:fs';
import path from 'node:path';

const DISH_MEDIA_PREFIX = '/media/dishes/';

export function menuImageForResponse(image, publicDir) {
  if (typeof image !== 'string' || !image.startsWith(DISH_MEDIA_PREFIX)) {
    return image || null;
  }

  const relativeName = image.slice(DISH_MEDIA_PREFIX.length).split(/[?#]/, 1)[0];
  if (!relativeName) return null;

  const mediaRoot = path.resolve(publicDir, 'media', 'dishes');
  const filePath = path.resolve(mediaRoot, relativeName);
  const relativePath = path.relative(mediaRoot, filePath);
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith('..' + path.sep) ||
    path.isAbsolute(relativePath) ||
    !fs.existsSync(filePath)
  ) {
    return null;
  }

  return image;
}

export function menuImageSrcsetForResponse(image, publicDir) {
  if (typeof image !== 'string' || !image.startsWith(DISH_MEDIA_PREFIX)) return null;

  const parts = image.slice(DISH_MEDIA_PREFIX.length).split(/[?#]/, 2);
  const relativeName = parts[0];
  const query = parts[1] || '';
  if (!relativeName || path.dirname(relativeName) !== '.' || !relativeName.endsWith('-card.webp')) return null;

  const mediaRoot = path.resolve(publicDir, 'media', 'dishes');
  const resizedRoot = path.resolve(mediaRoot, 'resized');
  const stem = path.basename(relativeName, '.webp');
  const version = new URLSearchParams(query).get('v');
  const candidates = [];

  for (const width of [300, 600]) {
    const fileName = stem + '-' + width + '.webp';
    const filePath = path.resolve(resizedRoot, fileName);
    const relativePath = path.relative(resizedRoot, filePath);
    if (!relativePath || relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath) || !fs.existsSync(filePath)) continue;
    const cacheVersion = version || String(Math.trunc(fs.statSync(filePath).mtimeMs));
    candidates.push('/media/dishes/resized/' + fileName + '?v=' + encodeURIComponent(cacheVersion) + ' ' + width + 'w');
  }

  return candidates.length ? candidates.join(', ') : null;
}
