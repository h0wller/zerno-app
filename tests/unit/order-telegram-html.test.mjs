import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dbPath = path.join(os.tmpdir(), `zerno-order-telegram-html-${randomUUID()}.db`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

const { escapeTelegramHtml } = await import('../../server/services/telegram.js');
const { buildOrderStaffText, buildOrderCustomerText } = await import('../../server/routes/orders.js');
const { db } = await import('../../server/db/connection.js');

const hostileOrder = {
  no: 73,
  by_staff: 0,
  name: '<b>Guest</b>',
  phone: '+7 900 000-00-01',
  method: 'delivery',
  place: '<b>Янтарный</b>',
  addr: 'Советская <script>alert(1)</script> & "дом"',
  slot: '17:00 <img src=x onerror=alert(1)>',
  pay: 'cash',
  comment: '<script>notify()</script> & "quoted"',
  items: [{
    qty: 1,
    name: '<b>Пицца</b>',
    opt: '<svg onload=alert(1)>',
    price: 900,
    modifiers: [{ name: '<i>Дополнительный сыр</i>', price: 100 }]
  }],
  gifts: [{ name: '<img src=x onerror=alert(1)>', qty: 1 }],
  total: 1000,
  discount: 100,
  discount_label: '<b>Скидка</b>',
  is_preorder: 1
};

after(() => {
  try { db.close(); } catch {}
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('Telegram HTML escaping encodes parser control characters without escaping static tags', () => {
  assert.equal(
    escapeTelegramHtml('<b>A & B</b> "quoted"'),
    '&lt;b&gt;A &amp; B&lt;/b&gt; &quot;quoted&quot;'
  );
});

test('staff order Telegram text escapes every user-controlled HTML field', () => {
  const text = buildOrderStaffText(hostileOrder, escapeTelegramHtml);

  assert.ok(text.includes('&lt;b&gt;Guest&lt;/b&gt;'));
  assert.ok(text.includes('&lt;b&gt;Янтарный&lt;/b&gt;'));
  assert.ok(text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(text.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(text.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(text.includes('&lt;i&gt;Дополнительный сыр&lt;/i&gt;'));
  assert.ok(text.includes('&amp; &quot;quoted&quot;'));
  assert.ok(!text.includes('<script>'));
  assert.ok(!text.includes('<img src=x'));
  assert.ok(!text.includes('<svg onload='));
});

test('customer order receipt Telegram text escapes item, modifier, address and comment fields', () => {
  const text = buildOrderCustomerText(hostileOrder, escapeTelegramHtml);

  assert.ok(text.includes('&lt;b&gt;Пицца&lt;/b&gt;'));
  assert.ok(text.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(text.includes('&lt;i&gt;Дополнительный сыр&lt;/i&gt;'));
  assert.ok(text.includes('&lt;script&gt;notify()&lt;/script&gt;'));
  assert.ok(text.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(text.includes('&amp; &quot;quoted&quot;'));
  assert.ok(!text.includes('<script>'));
  assert.ok(!text.includes('<img src=x'));
});

test('default order text remains plain/raw for non-Telegram push channels', () => {
  const staffText = buildOrderStaffText(hostileOrder);
  const customerText = buildOrderCustomerText(hostileOrder);

  assert.ok(staffText.includes('<script>alert(1)</script>'));
  assert.ok(customerText.includes('<script>notify()</script>'));
});
