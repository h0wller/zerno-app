import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

function createWorker(initialClients = []) {
  const handlers = new Map();
  const shown = [];
  const messages = [];
  const opened = [];
  const skipWaitingCalls = [];
  let clients = initialClients;
  const scope = {
    URL,
    console,
    location: { origin: 'https://zerno.test' },
    addEventListener(type, handler) {
      const bucket = handlers.get(type) || [];
      bucket.push(handler);
      handlers.set(type, bucket);
    },
    skipWaiting: async () => { skipWaitingCalls.push(true); },
    caches: {
      open: async () => ({ add: async () => {} }),
      keys: async () => [],
      delete: async () => true,
      match: async () => null
    },
    fetch: async () => new Response('ok'),
    clients: {
      matchAll: async () => clients,
      openWindow: async url => {
        opened.push(url);
        return { url, focus: async () => {} };
      }
    },
    registration: {
      showNotification: async (title, options) => {
        shown.push({ title, options });
      }
    }
  };
  scope.self = scope;
  vm.runInNewContext(source, scope, { filename: 'public/sw.js' });

  return {
    handlers, shown, messages, opened, skipWaitingCalls,
    setClients(value) { clients = value; },
    async dispatch(type, event) {
      const list = handlers.get(type) || [];
      assert.ok(list.length, 'Service Worker must register a ' + type + ' handler');
      for (const handler of list) handler(event);
      if (event.__waitUntil) await event.__waitUntil;
    }
  };
}

test('Service Worker displays incoming Web Push and wakes live refresh subscribers', async () => {
  const worker = createWorker();
  const clients = [{
    url: 'https://zerno.test/',
    postMessage(message) { worker.messages.push(message); }
  }];
  worker.setClients(clients);

  const event = {
    data: { json: () => ({ title: 'Заказ принят', body: 'Заказ #42 обновлён', url: '/?tab=orders' }) },
    waitUntil(promise) { this.__waitUntil = promise; }
  };
  await worker.dispatch('push', event);

  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].title, 'Заказ принят');
  assert.equal(worker.shown[0].options.body, 'Заказ #42 обновлён');
  assert.equal(worker.shown[0].options.data.url, new URL('/?tab=orders', 'https://zerno.test').href);
  assert.ok(worker.messages.some(message => message.type === 'zpush'));
});

test('Service Worker parses text payloads and provides a visible fallback notification', async () => {
  const worker = createWorker();
  const event = {
    data: { text: () => JSON.stringify({ body: 'Текст уведомления' }) },
    waitUntil(promise) { this.__waitUntil = promise; }
  };
  await worker.dispatch('push', event);

  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].title, '…и кофе');
  assert.equal(worker.shown[0].options.body, 'Текст уведомления');
});

test('notification click focuses an existing app window and navigates only within same origin', async () => {
  const worker = createWorker();
  let focused = 0;
  let navigated = '';
  const client = {
    url: 'https://zerno.test/',
    focus: async () => { focused++; },
    navigate: async url => { navigated = url; }
  };
  worker.setClients([client]);
  const event = {
    notification: { data: { url: '/?tab=orders' }, close() { this.closed = true; } },
    waitUntil(promise) { this.__waitUntil = promise; }
  };
  await worker.dispatch('notificationclick', event);

  assert.equal(event.notification.closed, true);
  assert.equal(focused, 1);
  assert.equal(navigated, 'https://zerno.test/?tab=orders');
  assert.equal(worker.opened.length, 0);
});

test('notification click rejects an external URL and opens the app root instead', async () => {
  const worker = createWorker();
  const event = {
    notification: { data: { url: 'https://attacker.invalid/phishing' }, close() {} },
    waitUntil(promise) { this.__waitUntil = promise; }
  };
  await worker.dispatch('notificationclick', event);

  assert.deepEqual(worker.opened, ['https://zerno.test/']);
});

test('new Service Worker waits for explicit user consent before activation', async () => {
  const worker = createWorker();
  const installEvent = {
    waitUntil(promise) { this.__waitUntil = promise; }
  };

  await worker.dispatch('install', installEvent);
  assert.equal(worker.skipWaitingCalls.length, 0, 'install must not skip the waiting phase');

  await worker.dispatch('message', { data: { type: 'UNRELATED_MESSAGE' } });
  assert.equal(worker.skipWaitingCalls.length, 0, 'unrelated messages must not activate the worker');

  await worker.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(worker.skipWaitingCalls.length, 1, 'explicit SKIP_WAITING consent activates the worker');
});


function createMediaCacheWorker(fetcher = async request => new Response('network:' + request.url, { status: 200 })) {
  const handlers = new Map();
  const entries = new Map();
  const staticEntries = new Map([['https://zerno.test/index.html', new Response('shell')]]);
  const apiEntries = new Map([['https://zerno.test/api/menu', new Response('menu')]]);
  const cachesByName = new Map([
    ['zerno-static-v670', staticEntries],
    ['zerno-media-v20', entries],
    ['zerno-api-v14', apiEntries]
  ]);
  const cacheFor = name => {
    if (!cachesByName.has(name)) cachesByName.set(name, new Map());
    const store = cachesByName.get(name);
    return {
      async put(request, response) { store.set(request.url, response); },
      async match(request) { return store.get(request.url) || null; },
      async keys() { return [...store.keys()].map(url => new Request(url)); },
      async delete(request) { return store.delete(request.url); }
    };
  };
  const scope = {
    URL,
    Request,
    Response,
    Headers,
    console,
    location: { origin: 'https://zerno.test' },
    addEventListener(type, handler) {
      const bucket = handlers.get(type) || [];
      bucket.push(handler);
      handlers.set(type, bucket);
    },
    caches: {
      async open(name) { return cacheFor(name); },
      async keys() { return [...cachesByName.keys()]; },
      async delete(name) { return cachesByName.delete(name); },
      async match(request) {
        for (const store of cachesByName.values()) {
          if (store.has(request.url)) return store.get(request.url);
        }
        return null;
      }
    },
    fetch: fetcher,
    clients: { matchAll: async () => [], openWindow: async () => null, claim: async () => {} },
    registration: { showNotification: async () => {} },
    skipWaiting: async () => {}
  };
  scope.self = scope;
  vm.runInNewContext(source, scope, { filename: 'public/sw.js' });

  return {
    entries,
    staticEntries,
    apiEntries,
    async fetch(url) {
      const event = {
        request: new Request(url),
        waits: [],
        respondWith(promise) { this.response = promise; },
        waitUntil(promise) { this.waits.push(promise); }
      };
      const listeners = handlers.get('fetch') || [];
      assert.ok(listeners.length, 'Service Worker must register a fetch handler');
      for (const listener of listeners) listener(event);
      assert.ok(event.response, 'media request must be handled by the Service Worker');
      const response = await event.response;
      await Promise.all(event.waits);
      return response;
    },
    async activate() {
      const event = { waits: [], waitUntil(promise) { this.waits.push(promise); } };
      const listeners = handlers.get('activate') || [];
      assert.ok(listeners.length, 'Service Worker must register an activate handler');
      for (const listener of listeners) listener(event);
      await Promise.all(event.waits);
    }
  };
}

test('Service Worker trims an oversized existing MEDIA_CACHE during activation', async () => {
  const worker = createMediaCacheWorker();
  const total = 305;
  for (let index = 0; index < total; index++) {
    worker.entries.set('https://zerno.test/media/legacy-' + index + '.webp', new Response('legacy:' + index));
  }

  await worker.activate();

  assert.equal(worker.entries.size, 300);
  for (let index = 0; index < total - 300; index++) {
    assert.equal(worker.entries.has('https://zerno.test/media/legacy-' + index + '.webp'), false,
      'activation should evict the oldest existing media entries');
  }
  assert.equal(worker.entries.has('https://zerno.test/media/legacy-304.webp'), true);
  assert.equal(worker.staticEntries.size, 1, 'activation cleanup must preserve STATIC_CACHE');
  assert.equal(worker.apiEntries.size, 1, 'activation cleanup must preserve API_CACHE');
});

test('Service Worker preserves offline fallback for SVG and raster media', async () => {
  let online = true;
  const worker = createMediaCacheWorker(async request => {
    if (!online) throw new Error('offline');
    return new Response('fresh:' + request.url, { status: 200 });
  });
  const svgUrl = 'https://zerno.test/media/brand-logo.svg';
  const rasterUrl = 'https://zerno.test/media/dish-offline.webp';

  let response = await worker.fetch(svgUrl);
  assert.equal(await response.text(), 'fresh:' + svgUrl);
  response = await worker.fetch(rasterUrl);
  assert.equal(await response.text(), 'fresh:' + rasterUrl);

  online = false;
  response = await worker.fetch(svgUrl);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'fresh:' + svgUrl, 'SVG Network-First should fall back to cached media');
  response = await worker.fetch(rasterUrl);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'fresh:' + rasterUrl, 'raster SWR should serve its cached match offline');
});

test('Service Worker serializes concurrent media writes so MEDIA_CACHE stays bounded', async () => {
  const worker = createMediaCacheWorker();
  const total = 305;

  const responses = await Promise.all(Array.from({ length: total }, (_, index) =>
    worker.fetch('https://zerno.test/media/concurrent-' + index + '.webp')
  ));

  assert.equal(responses.length, total);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(worker.entries.size, 300);
});

test('Service Worker bounds MEDIA_CACHE with FIFO eviction and leaves shell/API caches intact', async () => {
  const worker = createMediaCacheWorker();
  const total = 305;

  for (let index = 0; index < total; index++) {
    const response = await worker.fetch('https://zerno.test/media/dish-' + index + '.webp');
    assert.equal(response.status, 200);
  }

  assert.equal(worker.entries.size, 300);
  for (let index = 0; index < total - 300; index++) {
    assert.equal(worker.entries.has('https://zerno.test/media/dish-' + index + '.webp'), false,
      'oldest media entry should be evicted first');
  }
  for (let index = total - 300; index < total; index++) {
    assert.equal(worker.entries.has('https://zerno.test/media/dish-' + index + '.webp'), true,
      'newest media entry should remain cached');
  }
  assert.equal(worker.staticEntries.size, 1, 'media eviction must not touch STATIC_CACHE');
  assert.equal(worker.apiEntries.size, 1, 'media eviction must not touch API_CACHE');
});
