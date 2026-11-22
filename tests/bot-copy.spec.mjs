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

test('tgSend retries malformed Telegram HTML without parse_mode', async () => {
  const sent = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    sent.push(body);
    if (body.parse_mode === 'HTML') {
      return { ok: false, status: 400, json: async () => ({ ok: false, description: "Bad Request: can't parse entities: Unexpected end tag" }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 7 } }) };
  };
  try {
    const result = await tgSend('123', '<b>Broken & text</i>');
    assert.equal(result.ok, true);
    assert.equal(result.parseModeFallback, true);
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(sent.length, 2);
  assert.equal(sent[0].parse_mode, 'HTML');
  assert.equal(Object.hasOwn(sent[1], 'parse_mode'), false);
  assert.equal(sent[1].text, 'Broken & text');
});

test('tgSend long HTML falls back before truncation so tags are never cut in half', async () => {
  const sent = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (_url, opts) => {
    sent.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 8 } }) };
  };
  try { await tgSend('123', '<b>' + 'A'.repeat(5000) + '</b>'); }
  finally { globalThis.fetch = orig; }
  assert.equal(sent.length, 1);
  assert.equal(Object.hasOwn(sent[0], 'parse_mode'), false);
  assert.equal(sent[0].text.length, 4096);
  assert.equal(sent[0].text.includes('<b>'), false);
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
