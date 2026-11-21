import fs from 'node:fs';
import path from 'node:path';

const DISH_MEDIA_PREFIX = '/media/dishes/';

function webpIntrinsicWidth(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (
    bytes.length < 30 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (payload + chunkSize > bytes.length) return null;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return 1 +
        bytes[payload + 4] +
        (bytes[payload + 5] << 8) +
        (bytes[payload + 6] << 16);
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[payload] === 0x2f) {
      return 1 +
        bytes[payload + 1] +
        ((bytes[payload + 2] & 0x3f) << 8);
    }

    if (
      chunkType === 'VP8 ' &&
      chunkSize >= 10 &&
      bytes[payload + 3] === 0x9d &&
      bytes[payload + 4] === 0x01 &&
      bytes[payload + 5] === 0x2a
    ) {
      return (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff;
    }

    offset = payload + chunkSize + (chunkSize & 1);
  }

  return null;
}

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
  const sourcePath = path.resolve(mediaRoot, relativeName);
  const sourceRelativePath = path.relative(mediaRoot, sourcePath);
  const sourceIsLocal = Boolean(
    sourceRelativePath &&
    sourceRelativePath !== '..' &&
    !sourceRelativePath.startsWith('..' + path.sep) &&
    !path.isAbsolute(sourceRelativePath) &&
    fs.existsSync(sourcePath)
  );
  const sourceSize = sourceIsLocal ? fs.statSync(sourcePath).size : Infinity;
  const candidates = [];

  const addResizedCandidate = (width) => {
    const fileName = stem + '-' + width + '.webp';
    const filePath = path.resolve(resizedRoot, fileName);
    const relativePath = path.relative(resizedRoot, filePath);
    if (
      !relativePath ||
      relativePath.startsWith('..' + path.sep) ||
      path.isAbsolute(relativePath) ||
      !fs.existsSync(filePath)
    ) return false;

    const cacheVersion = version || String(Math.trunc(fs.statSync(filePath).mtimeMs));
    candidates.push('/media/dishes/resized/' + fileName + '?v=' + encodeURIComponent(cacheVersion) + ' ' + width + 'w');
    return true;
  };

  addResizedCandidate(300);

  const largeName = stem + '-600.webp';
  const largePath = path.resolve(resizedRoot, largeName);
  const largeRelativePath = path.relative(resizedRoot, largePath);
  const largeIsLocal = Boolean(
    largeRelativePath &&
    !largeRelativePath.startsWith('..' + path.sep) &&
    !path.isAbsolute(largeRelativePath) &&
    fs.existsSync(largePath)
  );

  if (largeIsLocal) {
    const largeSize = fs.statSync(largePath).size;
    if (sourceIsLocal && sourceSize > 0 && sourceSize <= largeSize) {
      // Some originals (600x375 / 640x400) are smaller than their square 600px crop.
      // Keep the original as the high-density candidate instead of transferring more bytes.
      const sourceWidth = webpIntrinsicWidth(sourcePath);
      if (sourceWidth && sourceWidth > 0) candidates.push(image + ' ' + sourceWidth + 'w');
      else addResizedCandidate(600);
    } else {
      addResizedCandidate(600);
    }
  }

  return candidates.length ? candidates.join(', ') : null;
}
