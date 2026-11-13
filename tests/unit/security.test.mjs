import { test, beforeEach } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { hashPin, safeEqual, pinLocks, lockedSeconds, registerFail } from '../../server/utils/security.js';

beforeEach(() => pinLocks.clear());

test('hashPin детерминирован и различает PIN', () => {
  assert.equal(hashPin('1234'), hashPin('1234'));
  assert.notEqual(hashPin('1234'), hashPin('1235'));
  assert.match(hashPin('1234'), /^[0-9a-f]{64}$/);
});

test('safeEqual сравнивает строки и числа', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual(1234, '1234'), true);
  assert.equal(safeEqual('', 'x'), false);
});

test('missing staff role secrets have no built-in fallback values', () => {
  const script = [
    "import { ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE } from './server/config.js';",
    "process.stdout.write(JSON.stringify([ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE]));"
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_CODE: '',
      CASHIER_CODE: '',
      DISPATCH_CODE: ''
    },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['', '', '']);
});

const req = (ip, xff) => ({ ip, headers: xff ? { 'x-forwarded-for': xff } : {} });

test('после 5 неудач гость блокируется на минуту', () => {
  const r = req('10.0.0.1');
  assert.equal(lockedSeconds(r, 'reg'), 0);
  for (let i = 0; i < 5; i++) registerFail(r, 'reg');
  const s = lockedSeconds(r, 'reg');
  assert.ok(s > 0 && s <= 60, 'блокировка должна быть активна: ' + s);
});

test('блокировка не переносится на другой IP', () => {
  for (let i = 0; i < 5; i++) registerFail(req('10.0.0.1'), 'reg');
  assert.equal(lockedSeconds(req('10.0.0.2'), 'reg'), 0);
});

test('подмена X-Forwarded-For не обходит блокировку', () => {
  // Злоумышленник с одного IP меняет заголовок X-Forwarded-For на каждый запрос.
  // Блокировка должна считаться по настоящему адресу соединения, а не по заголовку.
  for (let i = 0; i < 5; i++) registerFail(req('10.0.0.1', '1.1.1.' + i), 'reg');
  assert.ok(lockedSeconds(req('10.0.0.1', '9.9.9.9'), 'reg') > 0);
});
