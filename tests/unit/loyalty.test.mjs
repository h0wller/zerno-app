import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cupWord, stampBar } from '../../server/utils/loyalty-helpers.js';

test('cupWord склоняет слово «чашка» по числу', () => {
  assert.equal(cupWord(1), 'чашка');
  assert.equal(cupWord(2), 'чашки');
  assert.equal(cupWord(4), 'чашки');
  assert.equal(cupWord(5), 'чашек');
  assert.equal(cupWord(11), 'чашек');
  assert.equal(cupWord(12), 'чашек');
  assert.equal(cupWord(14), 'чашек');
  assert.equal(cupWord(21), 'чашка');
  assert.equal(cupWord(22), 'чашки');
  assert.equal(cupWord(111), 'чашек');
});

test('stampBar рисует 10 ячеек и ограничивает значения', () => {
  const full = '🫘'.repeat(10);
  const empty = '⚪'.repeat(10);
  assert.equal(stampBar(0), empty);
  assert.equal(stampBar(3), '🫘🫘🫘' + '⚪'.repeat(7));
  assert.equal(stampBar(10), full);
  assert.equal(stampBar(15), full);
  assert.equal(stampBar(-2), empty);
});
