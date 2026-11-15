// Проверка подписи Telegram Mini App и свежести initData.
// Эталонную подпись считаем здесь независимо от кода сервера, по спецификации Telegram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTgInitData, isTgAuthFresh, TG_INITDATA_MAX_AGE } from '../../server/utils/tg-auth.js';

const BOT = '123456:TEST_TOKEN_for_unit_tests';

function signInitData(fields, botToken = BOT) {
  const entries = Object.entries(fields).sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const user = JSON.stringify({ id: 42, first_name: 'Аня' });

test('валидная подпись возвращает пользователя и auth_date', () => {
  const now = Math.floor(Date.now() / 1000);
  const init = signInitData({ auth_date: String(now), user });
  const r = validateTgInitData(init, BOT);
  assert.ok(r, 'должен пройти проверку');
  assert.equal(r.user.id, 42);
  assert.equal(r.authDate, now);
});

test('подмена поля после подписи ломает проверку', () => {
  const now = Math.floor(Date.now() / 1000);
  const signed = signInitData({ auth_date: String(now), user });
  const tampered = signed.replace('auth_date=' + now, 'auth_date=' + (now + 1));
  assert.equal(validateTgInitData(tampered, BOT), null);
});

test('подмена пользователя ломает проверку', () => {
  const now = Math.floor(Date.now() / 1000);
  const signed = signInitData({ auth_date: String(now), user });
  const other = JSON.stringify({ id: 999, first_name: 'Чужой' });
  const tampered = new URLSearchParams(signed);
  tampered.set('user', other);
  assert.equal(validateTgInitData(tampered.toString(), BOT), null);
});

test('данные, подписанные другим токеном, отклоняются', () => {
  const now = Math.floor(Date.now() / 1000);
  const init = signInitData({ auth_date: String(now), user }, 'other:TOKEN');
  assert.equal(validateTgInitData(init, BOT), null);
});

test('без hash, без user и без токена — отказ', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(validateTgInitData(`auth_date=${now}&user=${encodeURIComponent(user)}`, BOT), null);
  assert.equal(validateTgInitData(signInitData({ auth_date: String(now) }), BOT), null);
  assert.equal(validateTgInitData(signInitData({ auth_date: String(now), user }), ''), null);
  assert.equal(validateTgInitData('', BOT), null);
});

test('свежесть: в пределах часа — да, старше — нет', () => {
  const now = 1_800_000_000;
  assert.equal(isTgAuthFresh(now - 100, now), true);
  assert.equal(isTgAuthFresh(now - TG_INITDATA_MAX_AGE, now), true);
  assert.equal(isTgAuthFresh(now - TG_INITDATA_MAX_AGE - 1, now), false);
  assert.equal(isTgAuthFresh(now - 86400, now), false);
});

test('свежесть: дата из будущего дальше минуты — нет, чуть вперёд — да', () => {
  const now = 1_800_000_000;
  assert.equal(isTgAuthFresh(now + 30, now), true);
  assert.equal(isTgAuthFresh(now + 120, now), false);
});

test('свежесть: нулевой или нечисловой auth_date — нет', () => {
  assert.equal(isTgAuthFresh(0), false);
  assert.equal(isTgAuthFresh(NaN), false);
  assert.equal(isTgAuthFresh(undefined), false);
});
