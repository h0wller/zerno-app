import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('SMS adapter refuses delivery without an explicit opt-in and never calls fetch', () => {
  const script = [
    "let fetchCalls = 0;",
    "globalThis.fetch = async () => { fetchCalls += 1; throw new Error('unexpected network access'); };",
    "const { sendSms } = await import('./server/services/sms.js');",
    "const result = await sendSms('+7 900 000-00-00', 'test OTP');",
    "process.stdout.write(JSON.stringify({ result, fetchCalls }));"
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SMS_AUTH_ENABLED: 'false',
      SMSRU_API_ID: 'test-key-that-must-not-be-used'
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual.result, { ok: false, reason: 'disabled' });
  assert.equal(actual.fetchCalls, 0);
});
