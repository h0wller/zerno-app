#!/usr/bin/env node
/* scripts/fetch-streets.mjs — Выгрузка всех улиц 13 посёлков из OpenStreetMap */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SETTLEMENTS = [
  { key: 'янтарный', name: 'пгт. Янтарный', lat: 54.8732, lon: 19.9378, radius: 2600 },
  { key: 'синявино', name: 'п. Синявино', lat: 54.8967, lon: 19.9702, radius: 1700 },
  { key: 'покровское', name: 'п. Покровское', lat: 54.8510, lon: 19.9570, radius: 1500 },
  { key: 'донское', name: 'п. Донское', lat: 54.9380, lon: 19.9670, radius: 1600 },
  { key: 'прислово', name: 'п. Прислово', lat: 54.9450, lon: 19.9980, radius: 1100 },
  { key: 'красноторовка', name: 'п. Красноторовка', lat: 54.9080, lon: 20.0630, radius: 1600 },
  { key: 'русское', name: 'п. Русское', lat: 54.8520, lon: 20.0760, radius: 1500 },
  { key: 'поваровка', name: 'п. Поваровка', lat: 54.8310, lon: 19.9880, radius: 1200 },
  { key: 'охотное', name: 'п. Охотное', lat: 54.8790, lon: 20.0760, radius: 1100 },
  { key: 'кленовое', name: 'п. Кленовое', lat: 54.8960, lon: 20.0380, radius: 1100 },
  { key: 'морозовка', name: 'п. Морозовка', lat: 54.8990, lon: 20.1080, radius: 1100 },
  { key: 'янтаровка', name: 'п. Янтаровка', lat: 54.8930, lon: 20.0070, radius: 1100 },
  { key: 'ягодное', name: 'п. Ягодное', lat: 54.9180, lon: 20.0210, radius: 1100 },
];

const FALLBACK_SEEDS = {
  'янтарный': [
    'Советская ул.', 'Балебина ул.', 'Железнодорожная ул.', 'Озёрная ул.',
    'Морская ул.', 'Береговая ул.', 'Парковая ул.', 'Лесная ул.',
    'Луговая ул.', 'Зелёная ул.', 'Новая ул.', 'Светлая ул.',
    'Полевая ул.', 'Серп и Молот ул.', 'Курортная ул.', 'Обогатительная ул.',
    'Сосновая ул.', 'Солнечная ул.', 'Спортивная ул.', 'Садовая ул.',
    'Майская ул.', 'Мира ул.', 'Облепиховая ул.', 'Песочная ул.',
    'пер. Советский', 'пер. Балебина', 'пер. Парковый', 'пер. Озёрный',
    'пер. Лесной', 'пер. Южный', 'пер. Спортивный', 'пр-д Парковый'
  ],
  'синявино': [
    'Центральная ул.', 'Морская ул.', 'Песочная ул.', 'Озёрная ул.',
    'Балтийская ул.', 'Береговая ул.', 'Садовая ул.', 'Синявинская ул.',
    'Лесная ул.', 'Верхняя ул.', 'Зелёная ул.', 'Школьная ул.',
    'Солнечная ул.', 'пер. Лесной'
  ],
  'покровское': [
    'Балтийская ул.', 'Покровская ул.', 'Луговая ул.', 'Школьная ул.',
    'Дорожная ул.', 'Озёрная ул.', 'Советская ул.', 'пер. Балтийский'
  ],
  'донское': [
    'Янтарная ул.', 'Садовая ул.', 'Степанова ул.', 'Школьная ул.',
    'Приморская ул.', 'Комсомольская ул.', 'Пионерская ул.', 'Лесная ул.',
    'пер. Школьный', 'пер. Садовый'
  ],
  'красноторовка': [
    'Центральная ул.', 'Школьная ул.', 'Садовая ул.', 'Калининградская ул.',
    'Зелёная ул.', 'Октябрьская ул.', 'Заречная ул.', 'Мира ул.', 'пер. Школьный'
  ],
  'русское': [
    'Победы ул.', 'Школьная ул.', 'Советская ул.', 'Полевая ул.',
    'Садовая ул.', 'Молодёжная ул.', 'Новая ул.', 'Дорожная ул.'
  ],
  'поваровка': ['Зелёная ул.', 'Полевая ул.', 'Дорожная ул.', 'Центральная ул.', 'Лесная ул.'],
  'охотное': ['Центральная ул.', 'Дорожная ул.', 'Заречная ул.'],
  'прислово': ['(без улицы)', 'Дорожная ул.', 'Морская ул.'],
  'кленовое': ['(без улицы)', 'Центральная ул.', 'Кленовая ул.'],
  'морозовка': ['(без улицы)', 'Зелёная ул.', 'Морозовская ул.'],
  'янтаровка': ['(без улицы)', 'Центральная ул.', 'Янтарная ул.'],
  'ягодное': ['(без улицы)', 'Садовая ул.', 'Ягодная ул.']
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchOverpass(lat, lon, radius) {
  const ql = `[out:json][timeout:25];way["highway"]["name"](around:${radius},${lat},${lon});out tags;`;

  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ZernoDeliveryBot/1.0 (contact: dev@andcoffee.online)'
        },
        body: 'data=' + encodeURIComponent(ql),
        signal: AbortSignal.timeout(15000)
      });

      if (res.status === 429) {
        process.stdout.write('(429, жду 8с) ');
        await sleep(8000);
        continue;
      }

      if (!res.ok) continue;
      const data = await res.json();
      return (data.elements || []).map(e => e.tags?.name).filter(Boolean);
    } catch (_) {}
  }
  return null;
}

function cleanStreetName(name) {
  let s = String(name || '').trim();
  if (/^(\d\d[А-Я]-\d+|[А-Я]-\d+|\d+\s*км)/i.test(s)) return null;
  if (!/(ул\.?|улица|пер\.?|переулок|пр-д|проезд|шоссе|тракт)/i.test(s)) {
    s += ' ул.';
  }
  return s;
}

async function main() {
  console.log('🚀 Опрос OpenStreetMap с защитой от 429 и таймаутов...\n');
  const result = {};

  for (const item of SETTLEMENTS) {
    process.stdout.write(`→ ${item.name}... `);
    const osmNames = await fetchOverpass(item.lat, item.lon, item.radius);

    let list = [];
    if (osmNames && osmNames.length > 0) {
      const set = new Set();
      for (const n of osmNames) {
        const cleaned = cleanStreetName(n);
        if (cleaned) set.add(cleaned);
      }
      list = Array.from(set);
    }

    const fb = FALLBACK_SEEDS[item.key] || ['(без улицы)'];
    if (!list.length) {
      list = fb;
      console.log(`[базовый реестр: ${list.length} улиц]`);
    } else {
      for (const s of fb) {
        if (!list.includes(s)) list.push(s);
      }
      console.log(`[ОК: ${list.length} улиц]`);
    }

    list.sort((a, b) => a.localeCompare(b, 'ru'));
    result[item.key] = list;

    // Пауза 2.5 сек между запросами, чтобы не ловить 429
    await sleep(2500);
  }

  const serverCode = `/* server/domain/address.js — Серверный реестр улиц и валидация адреса (сгенерировано fetch-streets) */

export const DELIVERY_SEEDS = ${JSON.stringify(result, null, 2)};

export function normPlace(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/^(пгт\\.?|пос\\.?|поселок|г\\.?|город|с\\.?|село|д\\.?)\\s+/i, '')
    .trim();
}

export function normStreet(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/^(ул\\.?|улица|пер\\.?|переулок|проезд|пр-т|проспект)\\s+/i, '')
    .replace(/\\s+(ул\\.?|улица|пер\\.?|переулок|проезд|пр-т|проспект)$/i, '')
    .replace(/[.,\\s]+$/, '')
    .trim();
}

export function getStreetSuggestions(place, query) {
  const cityKey = normPlace(place);
  const streets = DELIVERY_SEEDS[cityKey] || [];
  const q = normStreet(query);
  if (!q) return streets.slice(0, 15);
  return streets.filter(s => normStreet(s).includes(q)).slice(0, 15);
}

export function validateDeliveryAddress(place, street, house) {
  if (typeof place === 'object' && place !== null) {
    const obj = place;
    if (obj.method === 'pickup') return null;
    place = obj.place;
    street = obj.street;
    house = obj.house;
    if (!street && obj.addr) return null;
  }

  const cityKey = normPlace(place);
  const streets = DELIVERY_SEEDS[cityKey];

  if (!streets) return null;

  const sNorm = normStreet(street);
  const matched = streets.find(s => normStreet(s) === sNorm || s === '(без улицы)');
  if (!matched && sNorm !== '(без улицы)' && sNorm !== 'без улицы') {
    return \`Улица «\${street}» не найдена в зоне доставки (\${place}). Выберите из подсказок.\`;
  }

  if (!String(house || '').trim()) {
    return 'Укажите номер дома';
  }

  return null;
}
`;

  const clientCode = `/* public/app/address.js — Подсказки улиц на витрине корзины (сгенерировано fetch-streets) */
(function () {
  'use strict';

  var LOCAL_STREETS = ${JSON.stringify(result, null, 2)};

  function normPlace(rawPlace) {
    return String(rawPlace || '').toLowerCase().trim()
      .replace(/^(пгт\\.?|пос\\.?|поселок|г\\.?|город|с\\.?|село|д\\.?)\\s+/i, '')
      .trim();
  }

  function populateStreets(place) {
    var dl = document.getElementById('streetSuggestions');
    if (!dl) return;
    var key = normPlace(place);
    var list = LOCAL_STREETS[key] || LOCAL_STREETS['янтарный'] || [];

    dl.innerHTML = list.map(function (street) {
      return '<option value="' + esc(street) + '">';
    }).join('');
  }

  function formatDisplayAddress(order) {
    if (!order) return '';
    if (order.method === 'pickup') {
      return '🛍 Самовывоз (Советская, 38А)';
    }
    var parts = [];
    if (order.place && order.place !== 'Самовывоз') parts.push(order.place);
    if (order.street) {
      parts.push(order.street + (order.house ? ', д. ' + order.house : ''));
    } else if (order.addr) {
      parts.push(order.addr);
    }
    return '🚗 ' + parts.join(', ');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var placeEl = document.getElementById('checkoutPlace');
    if (placeEl) {
      populateStreets(placeEl.value);
      placeEl.addEventListener('change', function () {
        populateStreets(placeEl.value);
      });
    }
  });

  window.AddressModule = {
    populateStreets: populateStreets,
    formatDisplayAddress: formatDisplayAddress,
    LOCAL_STREETS: LOCAL_STREETS
  };
})();
`;

  fs.writeFileSync(path.join(ROOT, 'server', 'domain', 'address.js'), serverCode, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'public', 'app', 'address.js'), clientCode, 'utf8');

  console.log('\n✅ Готово! Все 13 посёлков сохранены в server/domain/address.js и public/app/address.js');
}

main().catch(err => {
  console.error('\n❌ Ошибка скрипта:', err);
  process.exit(1);
});