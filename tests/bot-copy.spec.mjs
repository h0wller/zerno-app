// tests/bot-copy.spec.mjs — F3.71: юнит-тесты чистого NLU-классификатора бота и трейнка tgSend.
// Без БД и сети: bot-nlu.js не имеет сайд-эффектов; fetch подменяется стабом.
import test from 'node:test';
import assert from 'node:assert';
import { botIntent } from '../server/utils/bot-nlu.js';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TEST_TOKEN = process.env.TEST_TOKEN || '123456:UNIT';
const { tgSend } = await import('../server/services/telegram.js');

test('botIntent classifies NLU phrases', () => {
  assert.equal(botIntent('позови оператора пожалуйста'), 'support');
  assert.equal(botIntent('сколько у меня штампов'), 'bonus');
  assert.equal(botIntent('где курьер'), 'orders');
  assert.equal(botIntent('до скольки вы работаете'), 'address');
  assert.equal(botIntent('хочу пиццу'), 'menu');
  assert.equal(botIntent('абывагд'), null);
});

test('tgSend truncates to Telegram limit 4096', async () => {
  const sent = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { sent.push(opts); return { ok: true, json: async () => ({ ok: true }) }; };
  try { await tgSend('123', 'A'.repeat(5000)); } finally { globalThis.fetch = orig; }
  assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].body);
  assert.ok(body.text.length <= 4096, 'text must fit 4096');
  assert.ok(body.text.endsWith('…'), 'truncated text ends with ellipsis');
});
