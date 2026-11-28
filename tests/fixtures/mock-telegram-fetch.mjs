// Test-only fetch interceptor for the integration suite. It never permits real Telegram API traffic.
if (process.env.ZERNO_MOCK_TELEGRAM_FETCH === '1') {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url || input);
    const match = url.match(/^https:\/\/api\.telegram\.org\/bot[^/]+\/(sendMessage|answerCallbackQuery)$/);
    if (!match) return realFetch(input, init);

    let payload = {};
    try {
      payload = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    } catch {}

    process.stdout.write('[TG_MOCK]' + JSON.stringify({
      method: match[1],
      payload
    }) + '\\n');

    return new Response(JSON.stringify({
      ok: true,
      result: { message_id: 9001 }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
}
