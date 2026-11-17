import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createPreviewApiResponse,
  installReadOnlyPreviewApi,
  isReadOnlyPreviewHost,
} from '../../public/app/core/preview-api.js';

async function readJson(response) {
  assert.ok(response instanceof Response);
  return response.json();
}

test('preview host matching is restricted to the dedicated Vercel project', () => {
  assert.equal(isReadOnlyPreviewHost('zerno-motion-preview.vercel.app'), true);
  assert.equal(
    isReadOnlyPreviewHost('zerno-motion-preview-git-feature-alexandrs-projects.vercel.app'),
    true,
  );
  assert.equal(isReadOnlyPreviewHost('friday.andcoffee.online'), false);
  assert.equal(isReadOnlyPreviewHost('zerno-motion-preview.example.com'), false);
  assert.equal(isReadOnlyPreviewHost('another-project.vercel.app'), false);
});

test('preview serves deterministic public catalog fixtures for both storefronts', async () => {
  const coffee = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/menu'),
    { method: 'GET' },
  ));
  const delivery = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/dmenu'),
    { method: 'GET' },
  ));

  assert.ok(coffee.items.some((item) => item.section === 'coffee'));
  assert.ok(delivery.items.some((item) => item.section === 'delivery'));
  assert.ok(delivery.items.some((item) => Array.isArray(item.opts) && item.opts.length > 0));
});

test('preview staff roles are synthetic and never read real customer records', async () => {
  const guest = createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/me'),
    { method: 'GET' },
    'guest',
  );
  const staff = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/me'),
    { method: 'GET' },
    'dispatch',
  ));

  assert.equal(guest.status, 401);
  assert.equal(staff.customer.role, 'dispatch');
  assert.match(staff.customer.id, /^preview-/);
});

test('all preview writes are rejected except ephemeral local chat simulation', async () => {
  const order = createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/orders'),
    { method: 'POST' },
  );
  const menuEdit = createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/menu/demo-id'),
    { method: 'PUT' },
  );
  const chat = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/chat/send'),
    { method: 'POST' },
  ));

  assert.equal(order.status, 403);
  assert.equal(menuEdit.status, 403);
  assert.equal(chat.ok, true);
  assert.equal(chat.preview, true);
});

test('unknown preview API reads fail closed instead of reaching a live backend', async () => {
  const response = createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/unmapped-endpoint'),
    { method: 'GET' },
  );
  const body = await readJson(response);

  assert.equal(response.status, 404);
  assert.match(body.error, /preview/i);
});


test('cashier preview returns synthetic customers and a demo audit log', async () => {
  const customers = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/staff/customers?search=Анна'),
    { method: 'GET' },
    'cashier',
  ));
  const log = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/staff/log?scope=coffee'),
    { method: 'GET' },
    'cashier',
  ));

  assert.equal(customers.customers[0].id, 'preview-customer-01');
  assert.match(log.log[0].a, /профиль открыт/i);
});

test('dispatcher preview returns only a synthetic order fixture', async () => {
  const result = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/orders'),
    { method: 'GET' },
    'dispatch',
  ));

  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].id, 'preview-order-1042');
  assert.match(result.orders[0].phone, /^\+7 900/);
});

test('admin preview returns deterministic analytics for both dashboard panes', async () => {
  const coffee = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/stats'),
    { method: 'GET' },
    'admin',
  ));
  const delivery = await readJson(createPreviewApiResponse(
    new URL('https://zerno-motion-preview.vercel.app/api/stats/orders?days=14'),
    { method: 'GET' },
    'admin',
  ));

  assert.equal(coffee.total, 248);
  assert.equal(coffee.days.length, 14);
  assert.equal(delivery.today.guest.orders, 3);
  assert.equal(delivery.days.length, 14);
});

test('preview fetch wrapper never forwards same-origin API requests to a live server', async () => {
  const forwarded = [];
  const fakeWindow = {
    location: {
      hostname: 'zerno-motion-preview-git-feature-alexandrs-projects.vercel.app',
      href: 'https://zerno-motion-preview-git-feature-alexandrs-projects.vercel.app/',
      search: '?brand=delivery&previewRole=dispatch',
      origin: 'https://zerno-motion-preview-git-feature-alexandrs-projects.vercel.app',
    },
    localStorage: { removeItem() {} },
    fetch(input, init) {
      forwarded.push({ input, init });
      return Promise.resolve(new Response('static asset'));
    },
    document: {
      title: 'Zerno',
      head: { appendChild() {} },
      documentElement: { dataset: {} },
      querySelector() { return null; },
      createElement() { return { name: '', content: '' }; },
    },
  };

  assert.equal(installReadOnlyPreviewApi(fakeWindow), true);
  const orderResponse = await fakeWindow.fetch('/api/orders', { method: 'POST' });
  assert.equal(orderResponse.status, 403);
  assert.equal(forwarded.length, 0);

  await fakeWindow.fetch('/app/ui/fonts.css');
  assert.equal(forwarded.length, 1);
  assert.equal(fakeWindow.__ZERNO_PREVIEW_ROLE__, 'dispatch');
  assert.equal(fakeWindow.__ZERNO_READONLY_PREVIEW__, true);
});


test('main initializes the state owner before installing the preview session token', async () => {
  const main = await readFile(new URL('../../public/app/main.js', import.meta.url), 'utf8');
  const stateImport = main.indexOf("import './core/state.js';");
  const apiImport = main.indexOf("import './core/api.js';");

  assert.notEqual(stateImport, -1);
  assert.notEqual(apiImport, -1);
  assert.ok(stateImport < apiImport, 'state.js must initialize first; preview api.js then applies synthetic role session');

  const fakeWindow = {
    USER_TOKEN: null,
    location: {
      hostname: 'zerno-motion-preview.vercel.app',
      href: 'https://zerno-motion-preview.vercel.app/?previewRole=dispatch',
      search: '?previewRole=dispatch',
      origin: 'https://zerno-motion-preview.vercel.app',
    },
    localStorage: { removeItem() {} },
    fetch: () => Promise.resolve(new Response('static asset')),
    document: {
      title: 'Zerno',
      head: { appendChild() {} },
      documentElement: { dataset: {} },
      querySelector() { return null; },
      createElement() { return { name: '', content: '' }; },
    },
  };

  assert.equal(installReadOnlyPreviewApi(fakeWindow), true);
  assert.equal(fakeWindow.USER_TOKEN, 'preview-session-dispatch');
});
