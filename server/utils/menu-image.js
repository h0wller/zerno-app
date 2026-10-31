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
