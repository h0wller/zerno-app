#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

const origin = new URL(process.env.LCP_FIXTURE_ORIGIN || 'https://friday.andcoffee.online');
const dbPath = process.env.DB_PATH;
const publicDir = path.resolve(process.env.PUBLIC_DIR || 'public');
if (!dbPath) throw new Error('DB_PATH must point at the isolated Lighthouse SQLite database');

async function getItems(endpoint, section) {
  const response = await fetch(new URL(endpoint, origin));
  if (!response.ok) throw new Error(`Unable to load ${endpoint}: HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error(`The ${section} API returned no menu items`);
  }
  return payload.items.map((item, index) => ({ ...item, section, sortOrder: index + 1 }));
}

function localAssetPath(assetUrl) {
  const url = new URL(assetUrl, origin);
  if (url.origin !== origin.origin || !url.pathname.startsWith('/media/dishes/')) return null;
  const target = path.resolve(publicDir, `.${url.pathname}`);
  const relative = path.relative(publicDir, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Rejected non-local media path: ${url.pathname}`);
  }
  return { url, target };
}

async function downloadAsset(assetUrl, required) {
  const local = localAssetPath(assetUrl);
  if (!local) return false;
  await fs.mkdir(path.dirname(local.target), { recursive: true });
  const response = await fetch(local.url);
  if (!response.ok) {
    if (required) throw new Error(`Required LCP image failed: ${local.url.pathname} HTTP ${response.status}`);
    console.warn(`[lighthouse-fixture] Skipping unavailable asset ${local.url.pathname}: HTTP ${response.status}`);
    return false;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Empty media response: ${local.url.pathname}`);
  await fs.writeFile(local.target, bytes);
  return true;
}

async function downloadMenuAssets(items, section) {
  const active = items.filter(item => item.on);
  const initialCategory = section === 'delivery' ? 'pizza' : 'coffee';
  const hero = active.find(item => item.cat === initialCategory && item.img);
  if (!hero?.img) {
    throw new Error(`The first visible ${section} (${initialCategory}) item has no image URL`);
  }

  const assets = [];
  for (const item of active) {
    if (item.img) assets.push({ url: item.img, required: item === hero });
    for (const candidate of String(item.imgSrcset || '').split(',')) {
      const url = candidate.trim().split(/\\s+/, 1)[0];
      if (url) assets.push({ url, required: false });
    }
  }

  const unique = [...new Map(assets.map(asset => [asset.url, asset])).values()];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(6, unique.length) }, async () => {
    while (cursor < unique.length) {
      const asset = unique[cursor++];
      await downloadAsset(asset.url, asset.required);
    }
  });
  await Promise.all(workers);
  return hero;
}

const [coffeeItems, deliveryItems] = await Promise.all([
  getItems('/api/menu', 'coffee'),
  getItems('/api/dmenu', 'delivery')
]);

const [coffeeHero, deliveryHero] = await Promise.all([
  downloadMenuAssets(coffeeItems, 'coffee'),
  downloadMenuAssets(deliveryItems, 'delivery')
]);

const db = new Database(dbPath);
try {
  const insert = db.prepare(`
    INSERT INTO menu
      (id, cat, e, name, descr, comp, vol, price, tag, coffee, is_on, img, section, opts, sort_order)
    VALUES
      (@id, @cat, @e, @name, @descr, @comp, @vol, @price, @tag, @coffee, @is_on, @img, @section, @opts, @sort_order)
  `);
  const replaceMenus = db.transaction(() => {
    db.exec('DELETE FROM menu');
    for (const item of [...coffeeItems, ...deliveryItems]) {
      insert.run({
        id: String(item.id),
        cat: String(item.cat || ''),
        e: String(item.e || ''),
        name: String(item.name || ''),
        descr: String(item.desc || ''),
        comp: JSON.stringify(Array.isArray(item.comp) ? item.comp : []),
        vol: String(item.vol || ''),
        price: String(item.price ?? ''),
        tag: String(item.tag || ''),
        coffee: item.coffee ? 1 : 0,
        is_on: item.on ? 1 : 0,
        img: item.img || null,
        section: item.section === 'delivery' ? 'delivery' : 'coffee',
        opts: JSON.stringify(Array.isArray(item.opts) ? item.opts : []),
        sort_order: item.sortOrder
      });
    }
  });
  replaceMenus();
} finally {
  db.close();
}

console.log(JSON.stringify({
  source: origin.origin,
  database: dbPath,
  coffee: { count: coffeeItems.length, first: { id: coffeeHero.id, name: coffeeHero.name, image: coffeeHero.img } },
  delivery: { count: deliveryItems.length, first: { id: deliveryHero.id, name: deliveryHero.name, image: deliveryHero.img } }
}, null, 2));
