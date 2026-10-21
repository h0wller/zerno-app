import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BONUS_KINDS, DEFAULT_BONUS_DAYS, cleanBonusConfig, mergeBonusConfig, makeBonusPromoCode,
} from '../../server/utils/bonus-config.js';

test('три вида бонусов', () => {
  assert.deepEqual(BONUS_KINDS, ['signup', 'qr', 'install']);
});

test('cleanBonusConfig ограничивает значения и заменяет мусор нулём', () => {
  const r = cleanBonusConfig({
    days: 999,
    kinds: { signup: { coffee: 99, delivery: 'abc' }, qr: { coffee: -3, delivery: 7000 } },
  });
  assert.equal(r.days, 365);
  assert.deepEqual(r.kinds.signup, { coffee: 10, delivery: 0 });
  assert.deepEqual(r.kinds.qr, { coffee: 0, delivery: 5000 });
  assert.deepEqual(r.kinds.install, { coffee: 0, delivery: 0 });
});

test('cleanBonusConfig без срока ставит умолчание и отбрасывает лишние виды', () => {
  const r = cleanBonusConfig({ kinds: { hack: { coffee: 10, delivery: 5000 } } });
  assert.equal(r.days, DEFAULT_BONUS_DAYS);
  assert.equal('hack' in r.kinds, false);
  assert.deepEqual(Object.keys(r.kinds).sort(), [...BONUS_KINDS].sort());
});

test('cleanBonusConfig: срок меньше одного дня поднимается до одного', () => {
  assert.equal(cleanBonusConfig({ days: 0 }).days, 1);
});

test('mergeBonusConfig для пустой базы даёт всё выключено', () => {
  const r = mergeBonusConfig({});
  assert.equal(r.days, DEFAULT_BONUS_DAYS);
  for (const k of BONUS_KINDS) assert.deepEqual(r.kinds[k], { coffee: 0, delivery: 0 });
});

test('mergeBonusConfig дополняет частичную настройку', () => {
  const r = mergeBonusConfig({ kinds: { qr: { coffee: 3 } } });
  assert.deepEqual(r.kinds.qr, { coffee: 3, delivery: 0 });
  assert.deepEqual(r.kinds.signup, { coffee: 0, delivery: 0 });
});

test('makeBonusPromoCode: формат B + 8 hex, уникальность на выборке', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = makeBonusPromoCode();
    assert.match(c, /^B[0-9A-F]{8}$/);
    seen.add(c);
  }
  assert.equal(seen.size, 2000);
});
