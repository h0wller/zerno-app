import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ph10, fmtPhone } from '../../server/utils/phone.js';

test('ph10 оставляет 10 цифр без кода страны', () => {
  assert.equal(ph10('+7 900 000-00-01'), '9000000001');
  assert.equal(ph10('89000000001'), '9000000001');
  assert.equal(ph10('9000000001'), '9000000001');
  assert.equal(ph10('+7 (900) 000 00 01'), '9000000001');
});

test('ph10 обрезает лишнее и пустые значения', () => {
  assert.equal(ph10('890000000019999'), '9000000001');
  assert.equal(ph10(''), '');
  assert.equal(ph10(undefined), '');
  assert.equal(ph10('abc'), '');
});

test('fmtPhone приводит к виду +7 XXX XXX-XX-XX', () => {
  assert.equal(fmtPhone('89000000001'), '+7 900 000-00-01');
  assert.equal(fmtPhone('9000'), '+7 900 0');
  assert.equal(fmtPhone(''), '');
});
