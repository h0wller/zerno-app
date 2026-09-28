// server/services/telegram.js
// Сервис Telegram: константы, tgSend, tgEnsureWebhook
// appKb остаётся в server.js (module-09)

export const TG_TOKEN = process.env.TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
export const TG_CHANNEL = process.env.TG_CHANNEL_ID || '';
export const TG_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'and_coffee_bot';
export const TG_WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || '';
const _normalizeUrl = (u) => String(u || '').replace(/\/+$/, '');
export const PUBLIC_URL = _normalizeUrl(process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : ''));
export const APP_URL = PUBLIC_URL || 'https://app.andcoffee.online';

export async function tgSend(chatId, text, kb) { // [tg-logging-v1]
  const token = process.env.TEST_TOKEN || TG_TOKEN;
  if (!token) { console.log('[tg] tgSend: NO TOKEN'); return; }
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (kb) body.reply_markup = kb;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) {
      console.error('[tg] tgSend FAIL → chat=' + chatId + '  err=' + (j.description || r.status));
      console.error('[tg] tgSend text was: ' + String(text).slice(0, 80));
      if (kb) console.error('[tg] tgSend kb was: ' + JSON.stringify(kb).slice(0, 200));
    }
  } catch (e) {
    console.error('[tg] tgSend NETWORK ERR: ' + e.message);
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
    if (info.ok && info.result && info.result.url === want && hasUpdates) { console.log('[tg] webhook уже наш и актуален:', want); return; }
    const body = { url: want, allowed_updates: ['message', 'callback_query', 'edited_message'] };
    if (TG_WEBHOOK_SECRET) body.secret_token = TG_WEBHOOK_SECRET;
    const set = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    console.log('[tg] setWebhook:', set.ok ? 'ok → ' + want : set.description);
  } catch (e) { console.log('[tg] webhook ensure error:', e.message); }
}