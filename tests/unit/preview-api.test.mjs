import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPreviewApiResponse,
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
