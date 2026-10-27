#!/usr/bin/env node
/* scripts/fetch-streets.mjs — Выгрузка и нормализация улиц 13 посёлков без лишних «ул.» */

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

// Чистый эталонный реестр без «ул.»
const FALLBACK_SEEDS = {
  'янтарный': [
    'Балебина', 'Береговая', 'Вишневая', 'Вокзальная', 'Гвардейская',
    'Железнодорожная', 'Заозерная', 'Зелёная', 'Курортная', 'Лесная',
    'Луговая', 'Майская', 'Мира', 'Морская', 'Новая', 'Облепиховая',
    'Обогатительная', 'Озёрная', 'Парковая', 'Песочная', 'Полевая',
    'Приморская', 'Садовая', 'Светлая', 'Серп и Молот', 'Советская',
    'Солнечная', 'Сосновая', 'Спортивная', 'Центральная', 'Юбилейная',
    'Ягодная', 'Янтарная',
    'пер. Балебина', 'пер. Балтийский', 'пер. Вокзальный', 'пер. Донской',
    'пер. Карьерный', 'пер. Клинический', 'пер. Лесной', 'пер. Лермонтова',
    'пер. Малый', 'пер. Озёрный', 'пер. Парковый', 'пер. Почтовый',
    'пер. Пушкина', 'пер. Сельский', 'пер. Советский', 'пер. Спортивный',
    'пер. Школьный', 'пер. Энергетический', 'пер. Южный',
    'пр-д Парковый', 'аллея Парковая', 'б-р Юбилейный'
  ],
  'синявино': [
    'Балтийская', 'Береговая', 'Верхняя', 'Зелёная', 'Лесная',
    'Морская', 'Озёрная', 'Песочная', 'Садовая', 'Синявинская',
    'Солнечная', 'Центральная', 'Школьная', 'пер. Лесной'
  ],
  'покровское': [
    'Балтийская', 'Дорожная', 'Луговая', 'Озёрная',
    'Покровская', 'Советская', 'Школьная', 'пер. Балтийский'
  ],
  'донское': [
    'Комсомольская', 'Лесная', 'Пионерская', 'Приморская',
    'Садовая', 'Степанова', 'Школьная', 'Янтарная',
    'пер. Садовый', 'пер. Школьный'
  ],
  'красноторовка': [
    'Заречная', 'Зелёная', 'Калининградская', 'Мира',
    'Октябрьская', 'Садовая', 'Центральная', 'Школьная',
    'пер. Школьный'
  ],
  'русское': [
    'Дорожная', 'Каштановая', 'Молодёжная', 'Новая', 'Победы',
    'Полевая', 'Пролетарская', 'Садовая', 'Советская', 'Сосновая', 'Школьная'
  ],
  'поваровка': [
    'Дорожная', 'Заречная', 'Зелёная', 'Лесная', 'Летняя',
    'Полевая', 'Центральная', 'пер. Каштановый'
  ],
  'охотное': ['Дорожная', 'Заречная', 'Центральная'],
  'прислово': ['(без улицы)', 'Дорожная', 'Морская'],
  'кленовое': ['(без улицы)', 'Кленовая', 'Лесная', 'Молодёжная', 'Новая', 'Центральная', 'Школьная'],
  'морозовка': ['(без улицы)', 'Зелёная', 'Кузнецкая', 'Молодёжная', 'Новая', 'Садовая', 'Центральная'],
  'янтаровка': ['(без улицы)', 'Центральная', 'Янтарная'],
  'ягодное': ['(без улицы)', 'Садовая', 'Ягодная']
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchOverpass(lat, lon, radius) {
  const ql = `[out:json][timeout:25];(
    way["highway"~"^(residential|living_street|secondary|tertiary|unclassified)$"]["name"](around:${radius},${lat},${lon});
  );out tags;`;

  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ZernoDeliveryBot/3.0'
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

// Отсекаем просеки, трассы, каналы и мусор
const JUNK_REGEX = /(гештель|просек|канал|дорога к|трасса|снт |днп |километр|\d+[А-Я]-\d+|автодорог|через|кольцо|променад)/i;

function cleanStreetName(name) {
  let s = String(name || '').trim();
  if (JUNK_REGEX.test(s)) return null;

  // 1. Выделяем тип, если это НЕ обычная улица
  let prefix = '';
  if (/(^|[\s,.\-])алле[яи](?=[\s,.\-]|$)/i.test(s)) {
    prefix = 'аллея';
  } else if (/(^|[\s,.\-])(бульвар|б-р)(?=[\s,.\-]|$)/i.test(s)) {
    prefix = 'б-р';
  } else if (/(^|[\s,.\-])(пер\.?|переул[а-я]*)(?=[\s,.\-]|$)/i.test(s)) {
    prefix = 'пер.';
  } else if (/(^|[\s,.\-])(пр-д|проезд)(?=[\s,.\-]|$)/i.test(s)) {
    prefix = 'пр-д';
  } else if (/(^|[\s,.\-])(ш\.?|шоссе)(?=[\s,.\-]|$)/i.test(s)) {
    prefix = 'ш.';
  } else if (/(^|[\s,.\-])(туп\.?|тупик)(?=[\s,.\-]|$)/i.test(s)) {
    prefix = 'туп.';
  }

  // 2. Срезаем все слова типов (кириллически безопасным способом без \b)
  const TYPE_WORDS = /(^|[\s,.\-])(ул\.?|улиц[а-я]*|пер\.?|переул[а-я]*|пр-д|проезд|ш\.?|шоссе|туп\.?|тупик|алле[яи]|бульвар|б-р)(?=[\s,.\-]|$)/gi;
  s = s.replace(TYPE_WORDS, ' ').replace(TYPE_WORDS, ' ');

  // 3. Убираем знаки препинания и множественные пробелы
  s = s.replace(/^[.,\s\-]+|[.,\s\-]+$/g, '').trim().replace(/\s+/g, ' ');
  if (!s || s.length < 2) return null;

  // 4. Первая буква заглавная
  s = s.charAt(0).toUpperCase() + s.slice(1);

  // Обычные улицы идут БЕЗ «ул.», спецтипы — с префиксом в начале
  return prefix ? `${prefix} ${s}` : s;
}

async function main() {
  console.log('🚀 Опрос OpenStreetMap с очисткой названий от «ул.»...\n');
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

    // Дополняем и нормализуем эталонный базовый список
    const fb = FALLBACK_SEEDS[item.key] || ['(без улицы)'];
    for (const s of fb) {
      const cleaned = cleanStreetName(s) || s;
      set.add(cleaned);
    }

    const list = Array.from(set);
    list.sort((a, b) => a.localeCompare(b, 'ru'));
    result[item.key] = list;

    console.log(`[чистых улиц: ${list.length}]`);
    await sleep(1500);
  }

  // 1. Формируем server/domain/address.js
  const serverCode = `/* server/domain/address.js — Серверный реестр улиц и валидация адреса (сгенерировано fetch-streets) */

export const DELIVERY_SEEDS = ${JSON.stringify(result, null, 2)};

export function normPlace(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/^(пгт\\.?|пос\\.?|поселок|г\\.?|город|с\\.?|село|д\\.?)\\s+/i, '')
    .trim();
}

export function normStreet(str) {
  const TYPE_WORDS = /(^|[\\s,.\\-])(ул\\.?|улиц[а-я]*|пер\\.?|переул[а-я]*|пр-д|проезд|ш\\.?|шоссе|туп\\.?|тупик|алле[яи]|бульвар|б-р)(?=[\\s,.\\-]|$)/gi;
  return String(str || '').toLowerCase().trim()
    .replace(TYPE_WORDS, ' ')
    .replace(TYPE_WORDS, ' ')
    .replace(/^[.,\\s\\-]+|[.,\\s\\-]+$/g, '')
    .replace(/\\s+/g, ' ')
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

  // 2. Формируем public/app/address.js
  const clientCode = `/* public/app/address.js — Подсказки улиц на витрине корзины (сгенерировано fetch-streets) */
(function () {
  'use strict';

  var LOCAL_STREETS = ${JSON.stringify(result, null, 2)};

  function normPlace(rawPlace) {
    return String(rawPlace || '').toLowerCase().trim()
      .replace(/^(пгт\\.?|пос\\.?|поселок|г\\.?|город|с\\.?|село|д\\.?)\\s+/i, '')
      .trim();
  }

  function normStreet(str) {
    var TYPE_WORDS = /(^|[\\s,.\\-])(ул\\.?|улиц[а-я]*|пер\\.?|переул[а-я]*|пр-д|проезд|ш\\.?|шоссе|туп\\.?|тупик|алле[яи]|бульвар|б-р)(?=[\\s,.\\-]|$)/gi;
    return String(str || '').toLowerCase().trim()
      .replace(TYPE_WORDS, ' ')
      .replace(TYPE_WORDS, ' ')
      .replace(/^[.,\\s\\-]+|[.,\\s\\-]+$/g, '')
      .replace(/\\s+/g, ' ')
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
    normStreet: normStreet,
    populateStreets: populateStreets,
    formatDisplayAddress: formatDisplayAddress,
    LOCAL_STREETS: LOCAL_STREETS
  };
})();
`;

  fs.writeFileSync(path.join(ROOT, 'server', 'domain', 'address.js'), serverCode, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'public', 'app', 'address.js'), clientCode, 'utf8');

  console.log('\n✅ Готово! Файлы пересобраны с чистыми названиями без «ул.».');
}

main().catch(err => {
  console.error('\n❌ Ошибка скрипта:', err);
  process.exit(1);
});