import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('webhook probe loads PUBLIC_URL from Node --env-file before validating CHAT_ID', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-webhook-probe-'));
  const envFile = path.join(dir, '.env');
  const script = path.resolve(import.meta.dirname, '../../scripts/probe-tg-webhook.mjs');

  try {
    fs.writeFileSync(envFile, 'PUBLIC_URL=https://probe.example///\nTG_WEBHOOK_SECRET=probe-secret\n');
    const result = spawnSync(process.execPath, [`--env-file=${envFile}`, script], {
      encoding: 'utf8',
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          !['PUBLIC_URL', 'APP_URL', 'TG_WEBHOOK_SECRET', 'CHAT_ID'].includes(key)
        )
      )
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /CHAT_ID/);
    assert.doesNotMatch(result.stderr, /Нет PUBLIC_URL/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
