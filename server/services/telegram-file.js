import { TG_TOKEN } from './telegram.js';

const TELEGRAM_FILE_MAX_BYTES = 1_048_576;

export async function downloadTelegramDocument(fileId, maxBytes = TELEGRAM_FILE_MAX_BYTES) {
  if (!TG_TOKEN || typeof fileId !== 'string' || !fileId.trim()) {
    throw new Error('Telegram file download is not configured');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > TELEGRAM_FILE_MAX_BYTES) {
    throw new TypeError('Invalid Telegram file size limit');
  }

  const metadataUrl = new URL('https://api.telegram.org/bot' + TG_TOKEN + '/getFile');
  metadataUrl.searchParams.set('file_id', fileId);
  const metadataResponse = await fetch(metadataUrl, { signal: AbortSignal.timeout(10_000) });
  const metadata = await metadataResponse.json().catch(() => null);
  const filePath = metadata?.result?.file_path;
  if (!metadataResponse.ok || !metadata?.ok || typeof filePath !== 'string' ||
      !filePath || filePath.startsWith('/') ||
      filePath.split('/').some(part => !part || part === '.' || part === '..') ||
      !/^[A-Za-z0-9_./-]+$/.test(filePath)) {
    throw new Error('Telegram did not return a valid file path');
  }

  const downloadUrl = new URL(filePath, 'https://api.telegram.org/file/bot' + TG_TOKEN + '/');
  if (downloadUrl.origin !== 'https://api.telegram.org' ||
      !downloadUrl.pathname.startsWith('/file/bot' + TG_TOKEN + '/')) {
    throw new Error('Telegram file path failed validation');
  }

  const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(15_000) });
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (!response.ok || !response.body || (declaredLength > 0 && declaredLength > maxBytes)) {
    throw new Error('Telegram file download failed or exceeded the size limit');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Telegram file exceeded the size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new Error('Telegram returned an empty file');
  return Buffer.concat(chunks, total);
}
