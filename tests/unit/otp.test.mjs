import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { otpStore, isOtpLive, consumeOtp } from '../../server/utils/otp.js';

beforeEach(() => otpStore.clear());

test('OTP is live only before its expiry timestamp', () => {
  const entry = { code: '1234', expires: 5000 };
  assert.equal(isOtpLive(entry, 4999), true);
  assert.equal(isOtpLive(entry, 5000), false);
  assert.equal(isOtpLive(null, 1), false);
  assert.equal(isOtpLive({ code: '1234' }, 1), false);
});

test('consumeOtp does not consume an expired entry or a failed match', () => {
  otpStore.set('reg:+7-test', { code: '1234', expires: 5000 });
  assert.equal(consumeOtp('reg:+7-test', entry => entry.code === '9999', 4000), null);
  assert.equal(otpStore.has('reg:+7-test'), true);
  assert.equal(consumeOtp('reg:+7-test', entry => entry.code === '1234', 5000), null);
  assert.equal(otpStore.has('reg:+7-test'), true);
});

test('consumeOtp returns and deletes a valid matching OTP exactly once', () => {
  otpStore.set('login:+7-test', { code: '4321', expires: 5000 });
  assert.deepEqual(consumeOtp('login:+7-test', entry => entry.code === '4321', 4999), {
    code: '4321', expires: 5000
  });
  assert.equal(otpStore.has('login:+7-test'), false);
  assert.equal(consumeOtp('login:+7-test', entry => entry.code === '4321', 4999), null);
});

test('consumeOtp supports confirmed Telegram contact sessions', () => {
  otpStore.set('reg:+7-test', { confirmed: true, tgChat: '123', expires: 5000 });
  const result = consumeOtp('reg:+7-test', entry => entry.confirmed && entry.tgChat === '123', 4999);
  assert.equal(result.confirmed, true);
  assert.equal(otpStore.has('reg:+7-test'), false);
});
