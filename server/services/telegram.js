// server/services/telegram.js
// Сервис Telegram: константы, tgSend, tgEnsureWebhook
// appKb остаётся в server.js (module-09)

// Боевой токен — TELEGRAM_BOT_TOKEN. TEST_TOKEN используем только вне production.
export const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ||
  (process.env.NODE_ENV !== 'production' ? (process.env.TEST_TOKEN || '') : '');
export const TG_CHANNEL = process.env.TG_CHANNEL_ID || '';
export const TG_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'and_coffee_bot';
export const TG_WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || '';
export const PUBLIC_URL = String(process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/+$/, '');
export const APP_URL = PUBLIC_URL || 'https://friday.andcoffee.online';

export function escapeTelegramHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function telegramHtmlToPlainText(value) {
  const newline = String.fromCharCode(10);
  return String(value || '')
    .replace(/<br[^>]*>/gi, newline)
    .replaceAll('</p>', newline)
    .replaceAll('</div>', newline)
    .replaceAll('</li>', newline)
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&amp;', '&');
}

export async function tgSend(chatId, text, kb) { // [tg-logging-v1]
  const token = TG_TOKEN;
  if (!token) return { ok: false, reason: 'no_token' };
  if (!chatId) return { ok: false, reason: 'no_chat' };

  if (TG_CHANNEL && String(chatId) === String(TG_CHANNEL) &&
      process.env.NODE_ENV !== 'production' && !process.env.TELEGRAM_FORCE_SEND) {
    console.log('[tg-dev-skip channel]:', String(text).slice(0, 70));
    return { ok: true, skipped: 'dev_channel' };
  }

  const TG_MAX = 4096;
  let html = String(text);
  let parseMode = 'HTML';
  if (html.length > TG_MAX) {
    // Never cut through an HTML tag/entity. Long messages fall back to readable plain text.
    html = telegramHtmlToPlainText(html);
    parseMode = null;
  }
  if (html.length > TG_MAX) html = html.slice(0, TG_MAX - 1) + '…';

  const send = async (message, mode) => {
    const body = { chat_id: chatId, text: message };
    if (mode) body.parse_mode = mode;
    if (kb) body.reply_markup = kb;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    return { response, result, payload: body };
  };

  try {
    let sent = await send(html, parseMode);
    const description = String(sent.result?.description || '');
    const parseError = /can't parse entities|can't find end of the entity|unsupported start tag|unsupported end tag/i.test(description);
    if ((!sent.response.ok || !sent.result?.ok) && parseMode === 'HTML' && parseError) {
      let plain = telegramHtmlToPlainText(html);
      if (plain.length > TG_MAX) plain = plain.slice(0, TG_MAX - 1) + '…';
      sent = await send(plain, null);
      if (sent.response.ok && sent.result?.ok) {
        return { ok: true, messageId: sent.result.result?.message_id ?? null, parseModeFallback: true };
      }
    }
    if (!sent.response.ok || !sent.result?.ok) {
      console.error('[tg] tgSend FAIL: ' + (sent.result?.description || sent.response.status));
      return {
        ok: false,
        reason: 'telegram_api_error',
        code: sent.response.status,
        error: sent.result?.description || 'Telegram API error'
      };
    }
    return { ok: true, messageId: sent.result.result?.message_id ?? null, plainFallback: !parseMode };
  } catch (error) {
    console.error('[tg] tgSend NETWORK ERR: ' + error.message);
    return { ok: false, reason: 'network_error', error: error.message };
  }
}

export async function tgEnsureWebhook() {
  if (!TG_TOKEN || !PUBLIC_URL) { console.log('[tg] webhook пропущен: нет TOKEN или PUBLIC_URL'); return; }
  const want = PUBLIC_URL + '/api/tg/webhook';
  try {
    const info = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo`).then(r => r.json());
    // [tg-ensure-webhook-allowed-updates-v1]
    const hasUpdates = Array.isArray(info.result?.allowed_updates) &&
      ['message', 'callback_query', 'edited_message'].every(x => info.result.allowed_updates.includes(x));
    // Секрет Telegram не показывает, поэтому при заданном секрете переустанавливаем вебхук каждый запуск.
    if (!TG_WEBHOOK_SECRET && info.ok && info.result && info.result.url === want && hasUpdates) { console.log('[tg] webhook уже наш и актуален:', want); return; }
    const body = { url: want, allowed_updates: ['message', 'callback_query', 'edited_message'] };
    if (TG_WEBHOOK_SECRET) body.secret_token = TG_WEBHOOK_SECRET;
    const set = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    console.log('[tg] setWebhook:', set.ok ? 'ok → ' + want : set.description);
  } catch (e) { console.log('[tg] webhook ensure error:', e.message); }
}