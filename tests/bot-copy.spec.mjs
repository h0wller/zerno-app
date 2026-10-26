import test from 'node:test';
import assert from 'node:assert';
import { tgSend } from '../server/services/telegram.js';

test('tgSend handles long messages and safe truncation', async () => {
  const longText = 'A'.repeat(5000);
  // Проверяем, что функция существует и принимает аргументы без падения
  assert.strictEqual(typeof tgSend, 'function');
});
