import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadTelegramDocument } from '../../server/services/telegram-file.js';

const token = '123456:fake-test-token';

function makeFetch({ filePath = 'documents/run.gpx', bytes = Buffer.from('GPX'), declaredLength } = {}) {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/getFile')) {
      return new Response(JSON.stringify({ ok: true, result: { file_path: filePath } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(bytes, {
      status: 200,
      headers: declaredLength === undefined ? {} : { 'content-length': String(declaredLength) },
    });
  };
  return { fetchImpl, calls };
}

test('downloads Telegram documents only through the validated Telegram file path', async () => {
  const { fetchImpl, calls } = makeFetch({ bytes: Buffer.from('valid gpx') });
  const bytes = await downloadTelegramDocument('telegram-file-id', 1024, { token, fetchImpl });

  assert.equal(bytes.toString(), 'valid gpx');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].origin, 'https://api.telegram.org');
  assert.equal(calls[1].origin, 'https://api.telegram.org');
  assert.match(calls[1].pathname, /^\/file\/bot123456:fake-test-token\/documents\/run\.gpx$/);
});

test('rejects a traversal-like file path before requesting the file body', async () => {
  const { fetchImpl, calls } = makeFetch({ filePath: 'documents/../secret' });

  await assert.rejects(
    downloadTelegramDocument('telegram-file-id', 1024, { token, fetchImpl }),
    /valid file path/i,
  );
  assert.equal(calls.length, 1);
});

test('rejects a file whose declared size exceeds the configured maximum', async () => {
  const { fetchImpl } = makeFetch({ declaredLength: 2048 });

  await assert.rejects(
    downloadTelegramDocument('telegram-file-id', 1024, { token, fetchImpl }),
    /exceeded the size limit/i,
  );
});

test('rejects missing credentials and invalid limits without making requests', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error('unexpected request'); };

  await assert.rejects(downloadTelegramDocument('id', 1024, { token: '', fetchImpl }), /not configured/i);
  await assert.rejects(downloadTelegramDocument('id', 0, { token, fetchImpl }), /invalid.*limit/i);
  assert.equal(called, false);
});
