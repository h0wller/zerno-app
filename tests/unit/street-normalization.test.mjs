import test from 'node:test';
import assert from 'node:assert/strict';
import { normStreet } from '../../server/domain/address.js';

test('normStreet removes every street-type token in one global pass', () => {
  assert.equal(normStreet('ул. Лесная, пер. Малый'), 'лесная, малый');
  assert.equal(normStreet('улица Советская и проезд Парковый'), 'советская и парковый');
  assert.equal(normStreet('шоссе Победы, тупик Южный'), 'победы, южный');
  assert.equal(normStreet('аллея Парковая, б-р Юбилейный'), 'парковая, юбилейный');
});

test('normStreet remains stable when normalized input is normalized again', () => {
  const normalized = normStreet('ул. Лесная, пер. Малый');
  assert.equal(normStreet(normalized), normalized);
});
