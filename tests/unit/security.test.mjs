import { test, beforeEach } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { hashPin, safeEqual } from '../../server/utils/security.js';
import { ActivateCodeSchema } from '../../server/middleware/validate.js';
import {
  clearAuthRateLimits,
  clearLock,
  lockedSeconds,
  registerFail
} from '../../server/utils/auth-rate-limits.js';

beforeEach(() => clearAuthRateLimits());

test('hashPin детерминирован и различает PIN', () => {
  assert.equal(hashPin('1234'), hashPin('1234'));
  assert.notEqual(hashPin('1234'), hashPin('1235'));
  assert.match(hashPin('1234'), /^[0-9a-f]{64}$/);
});

test('staff role code validation requires 16–64 allowed characters', () => {
  assert.equal(ActivateCodeSchema.safeParse({ code: 'ci-admin-role-code-2026' }).success, true);
  assert.equal(ActivateCodeSchema.safeParse({ code: '1234' }).success, false);
  assert.equal(ActivateCodeSchema.safeParse({ code: 'has spaces and is long enough' }).success, false);
  assert.equal(ActivateCodeSchema.safeParse({ code: 'x'.repeat(65) }).success, false);
});

test('missing staff role secrets have no built-in fallback values', () => {
  const script = [
    "import { ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE } from './server/config.js';",
    "process.stdout.write(JSON.stringify([ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE]));"
  ].join('\\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, ADMIN_CODE: '', CASHIER_CODE: '', DISPATCH_CODE: '' },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['', '', '']);
});

test('safeEqual сравнивает строки и числа', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual(1234, '1234'), true);
  assert.equal(safeEqual('', 'x'), false);
});

const req = (ip, xff) => ({ ip, headers: xff ? { 'x-forwarded-for': xff } : {} });

test('после 5 неудач гостя блокирует минуту', () => {
  const request = req('10.0.0.1');
  assert.equal(lockedSeconds(request, 'reg'), 0);
  for (let i = 0; i < 5; i++) registerFail(request, 'reg');
  const remaining = lockedSeconds(request, 'reg');
  assert.ok(remaining > 0 && remaining <= 60, 'блокировка должна быть активна: ' + remaining);
});

test('блокировка без subject не переносится на другой IP', () => {
  for (let i = 0; i < 5; i++) registerFail(req('10.0.0.1'), 'reg');
  assert.equal(lockedSeconds(req('10.0.0.2'), 'reg'), 0);
});

test('подмена X-Forwarded-For не обходит блокировку', () => {
  // Злоумышленник с одного IP меняет заголовок X-Forwarded-For на каждый запрос.
  // Блокировка должна считаться по req.ip, если proxy не объявлен доверенным.
  for (let i = 0; i < 5; i++) registerFail(req('10.0.0.1', '1.1.1.' + i), 'reg');
  assert.ok(lockedSeconds(req('10.0.0.1', '9.9.9.9'), 'reg') > 0);
});

test('блокировка по IP + телефону не блокирует другого клиента за тем же NAT', () => {
  const ip = '10.0.0.1';
  const firstPhone = '+79002001001';
  const secondPhone = '+79002001002';
  for (let i = 0; i < 5; i++) registerFail(req(ip), 'login', firstPhone);

  assert.ok(lockedSeconds(req(ip), 'login', firstPhone) > 0);
  assert.equal(lockedSeconds(req(ip), 'login', secondPhone), 0);
});

test('тот же телефон остаётся заблокированным при смене IP', () => {
  const phone = '+79002001003';
  for (let i = 0; i < 5; i++) registerFail(req('10.0.0.1'), 'login', phone);
  assert.ok(lockedSeconds(req('10.0.0.2'), 'login', phone) > 0);
});

test('успешная проверка очищает lock для телефона', () => {
  const request = req('10.0.0.1');
  const phone = '+79002001004';
  for (let i = 0; i < 5; i++) registerFail(request, 'login', phone);
  assert.ok(lockedSeconds(request, 'login', phone) > 0);

  clearLock(request, 'login', phone);
  assert.equal(lockedSeconds(request, 'login', phone), 0);
  assert.equal(lockedSeconds(req('10.0.0.2'), 'login', phone), 0);
});
