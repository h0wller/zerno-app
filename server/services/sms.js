// server/services/sms.js
// SMS.ru delivery adapter. Never log OTP values or destination phone numbers.
import { ph10 } from '../utils/phone.js';

const SMS_API = process.env.SMSRU_API_ID || '';

export async function sendSms(phone, text) {
  const digits = ph10(phone);
  if (digits.length !== 10) return { ok: false, reason: 'invalid_phone' };

  // Integration tests use the same route contract without contacting a paid provider.
  if (!SMS_API) {
    if (process.env.NODE_ENV === 'test') return { ok: true, test: true };
    console.error('[sms] SMSRU_API_ID is not configured');
    return { ok: false, reason: 'not_configured' };
  }

  const destination = '7' + digits;
  const url = new URL('https://sms.ru/sms/send');
  url.searchParams.set('api_id', SMS_API);
  url.searchParams.set('to', destination);
  url.searchParams.set('msg', String(text));
  url.searchParams.set('json', '1');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const result = await response.json().catch(() => null);
    const accepted = response.ok
      && result?.status === 'OK'
      && result?.sms?.[destination]?.status === 'OK';
    return accepted
      ? { ok: true, provider: 'sms.ru' }
      : { ok: false, reason: 'provider_rejected', statusCode: response.status };
  } catch (error) {
    console.error('[sms] Provider request failed:', error.name || 'network_error');
    return { ok: false, reason: 'provider_unavailable' };
  }
}
