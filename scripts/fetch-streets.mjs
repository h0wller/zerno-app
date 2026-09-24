#!/usr/bin/env node
/* scripts/fetch-streets.mjs — Выгрузка и нормализация улиц 13 посёлков */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SETTLEMENTS = [
  { key: 'янтарный', name: 'пгт. Янтарный', lat: 54.8732, lon: 19.9378, radius: 2400 },
  { key: 'синявино', name: 'п. Синявино', lat: 54.8967, lon: 19.9702, radius: 1600 },
  { key: 'покровское', name: 'п. Покровское', lat: 54.8510, lon: 19.9570, radius: 1400 },
  { key: 'донское', name: 'п. Донское', lat: 54.9380, lon: 19.9670, radius: 1500 },
  { key: 'прислово', name: 'п. Прислово', lat: 54.9450, lon: 19.9980, radius: 1000 },
  { key: 'красноторовка', name: 'п. Красноторовка', lat: 54.9080, lon: 20.0630, radius: 1500 },
  { key: 'русское', name: 'п. Русское', lat: 54.8520, lon: 20.0760, radius: 1400 },
  { key: 'поваровка', name: 'п. Поваровка', lat: 54.8310, lon: 19.9880, radius: 1100 },
  { key: 'охотное', name: 'п. Охотное', lat: 54.8790, lon: 20.0760, radius: 1000 },
  { key: 'кленовое', name: 'п. Кленовое', lat: 54.8960, lon: 20.0380, radius: 1000 },
  { key: 'морозовка', name: 'п. Морозовка', lat: 54.8990, lon: 20.1080, radius: 1000 },
  { key: 'янтаровка', name: 'п. Янтаровка', lat: 54.8930, lon: 20.0070, radius: 1000 },
  { key: 'ягодное', name: 'п. Ягодное', lat: 54.9180, lon: 20.0210, radius: 1000 },
];

const FALLBACK_SEEDS = {
  'янтарный': [
    'ул. Балебина', 'ул. Береговая', 'ул. Вокзальная', 'ул. Гвардейская',
    'ул. Железнодорожная', 'ул. Заозерная', 'ул. Зелёная', 'ул. Курортная',
    'ул. Лесная', 'ул. Луговая', 'ул. Майская', 'ул. Мира', 'ул. Морская',
    'ул. Новая', 'ул. Облепиховая', 'ул. Обогатительная', 'ул. Озёрная',
    'ул. Парковая', 'ул. Песочная', 'ул. Полевая', 'ул. Приморская',
    'ул. Садовая', 'ул. Светлая', 'ул. Серп и Молот', 'ул. Советская',
    'ул. Солнечная', 'ул. Сосновая', 'ул. Спортивная', 'ул. Центральная',
    'ул. Юбилейная', 'ул. Ягодная', 'ул. Янтарная',
    'пер. Балебина', 'пер. Балтийский', 'пер. Вокзальный', 'пер. Донской',
    'пер. Карьерный', 'пер. Клинический', 'пер. Лесной', 'пер. Лермонтова',
    'пер. Малый', 'пер. Озёрный', 'пер. Парковый', 'пер. Почтовый',
    'пер. Пушкина', 'пер. Сельский', 'пер. Советский', 'пер. Спортивный',
    'пер. Школьный', 'пер. Энергетический', 'пер. Южный', 'пр-д Парковый'
  ],
  'синявино': [
    'ул. Балтийская', 'ул. Береговая', 'ул. Верхняя', 'ул. Зелёная',
    'ул. Лесная', 'ул. Морская', 'ул. Озёрная', 'ул. Песочная',
    'ул. Садовая', 'ул. Синявинская', 'ул. Солнечная', 'ул. Центральная',
    'ул. Школьная', 'пер. Лесной'
  ],
  'покровское': [
    'ул. Балтийская', 'ул. Дорожная', 'ул. Луговая', 'ул. Озёрная',
    'ул. Покровская', 'ул. Советская', 'ул. Школьная', 'пер. Балтийский'
  ],
  'донское': [
    'ул. Комсомольская', 'ул. Лесная', 'ул. Пионерская', 'ул. Приморская',
    'ул. Садовая', 'ул. Степанова', 'ул. Школьная', 'ул. Янтарная',
    'пер. Садовый', 'пер. Школьный'
  ],
  'красноторовка': [
    'ул. Заречная', 'ул. Зелёная', 'ул. Калининградская', 'ул. Мира',
    'ул. Октябрьская', 'ул. Садовая', 'ул. Центральная', 'ул. Школьная',
    'пер. Школьный'
  ],
  'русское': [
    'ул. Дорожная', 'ул. Молодёжная', 'ул. Новая', 'ул. Победы',
    'ул. Полевая', 'ул. Садовая', 'ул. Советская', 'ул. Школьная'
  ],
  'поваровка': [
    'ул. Дорожная', 'ул. Заречная', 'ул. Зелёная', 'ул. Лесная',
    'ул. Летняя', 'ул. Полевая', 'ул. Центральная', 'пер. Каштановый'
  ],
  'охотное': ['ул. Дорожная', 'ул. Заречная', 'ул. Центральная'],
  'прислово': ['(без улицы)', 'ул. Дорожная', 'ул. Морская'],
  'кленовое': ['(без улицы)', 'ул. Кленовая', 'ул. Молодёжная', 'ул. Новая', 'ул. Центральная', 'ул. Школьная'],
  'морозовка': ['(без улицы)', 'ул. Зелёная', 'ул. Кузнецкая', 'ул. Молодёжная', 'ул. Новая', 'ул. Садовая', 'ул. Центральная'],
  'янтаровка': ['(без улицы)', 'ул. Центральная', 'ул. Янтарная'],
  'ягодное': ['(без улицы)', 'ул. Садовая', 'ул. Ягодная']
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchOverpass(lat, lon, radius) {
  // Запрашиваем только реальные жилые дороги, исключая лесные просеки
  const ql = `[out:json][timeout:25];(
    way["highway"~"^(residential|living_street|secondary|tertiary|unclassified)$"]["name"](around:${radius},${lat},${lon});
  );out tags;`;

  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ZernoDeliveryBot/2.0'
        },
        body: 'data=' + encodeURIComponent(ql),
        signal: AbortSignal.timeout(15000)
      });

      if (res.status === 429) {
        process.stdout.write('(429, жду 6с) ');
        await sleep(6000);
        continue;
      }

      if (!res.ok) continue;
      const data = await res.json();
      return (data.elements || []).map(e => e.tags?.name).filter(Boolean);
    } catch (_) {}
  }
  return null;
}

const JUNK_REGEX = /(гештель|просек|канал|дорога к|трасса|снт |днп |километр|\d+[А-Я]-\d+|автодорог|через|кольцо|променад)/i;

function cleanStreetName(name) {
  let s = String(name || '').trim();
  if (JUNK_REGEX.test(s)) return null;

  // Распознаём тип улицы
  let stType = 'ул.';
  if (/\b(пер\.?|переулок)\b/i.test(s)) {
    stType = 'пер.';
    s = s.replace(/\b(пер\.?|переулок)\b/ig, '');
  } else if (/\b(пр-д|проезд)\b/i.test(s)) {
    stType = 'пр-д';
    s = s.replace(/\b(пр-д|проезд)\b/ig, '');
  } else if (/\b(ш\.?|шоссе)\b/i.test(s)) {
    stType = 'ш.';
    s = s.replace(/\b(ш\.?|шоссе)\b/ig, '');
  } else if (/\b(аллея)\b/i.test(s)) {
    stType = 'аллея';
    s = s.replace(/\b(аллея)\b/ig, '');
  } else if (/\b(бульвар|б-р)\b/i.test(s)) {
    stType = 'бульвар';
    s = s.replace(/\b(бульвар|б-р)\b/ig, '');
  } else {
    s = s.replace(/\b(ул\.?|улица)\b/ig, '');
  }

  // Очищаем от знаков пунктуации и лишних пробелов
  s = s.replace(/^[.,\s\-]+|[.,\s\-]+$/g, '').trim();
  if (!s || s.length < 2) return null;

  // Делаем заглавную букву
  s = s.charAt(0).toUpperCase() + s.slice(1);

  // Возвращаем в привычном русском формате: «ул. Советская», «пер. Школьный»
  return `${stType} ${s}`;
}

async function main() {
  console.log('🚀 Опрос OpenStreetMap с нормализацией формата...\n');
  const result = {};

  for (const item of SETTLEMENTS) {
    process.stdout.write(`→ ${item.name}... `);
    const osmNames = await fetchOverpass(item.lat, item.lon, item.radius);

    const set = new Set();

    if (osmNames && osmNames.length > 0) {
      for (const n of osmNames) {
        const cleaned = cleanStreetName(n);
        if (cleaned) set.add(cleaned);
      }
    }

    // Дополняем эталонным базовым списком
    const fb = FALLBACK_SEEDS[item.key] || ['(без улицы)'];
    for (const s of fb) {
      set.add(s);
    }

    const list = Array.from(set);
    list.sort((a, b) => a.localeCompare(b, 'ru'));
    result[item.key] = list;

    console.log(`[чистых улиц: ${list.length}]`);
    await sleep(1500);
  }

  // Генерация server/domain/address.js
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

  // Генерация public/app/address.js
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
    normPlace: normPlace,
    populateStreets: populateStreets,
    formatDisplayAddress: formatDisplayAddress,
    LOCAL_STREETS: LOCAL_STREETS
  };
})();
`;

  fs.writeFileSync(path.join(ROOT, 'server', 'domain', 'address.js'), serverCode, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'public', 'app', 'address.js'), clientCode, 'utf8');

  console.log('\n✅ Готово! Все названия нормализованы, дубли и трассы устранены.');
}

main().catch(err => {
  console.error('\n❌ Ошибка скрипта:', err);
  process.exit(1);
});