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
    skipWaiting: async () => {},
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
    handlers, shown, messages, opened,
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
  assert.equal(worker.shown[0].options.data.url, '/?tab=orders');
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
