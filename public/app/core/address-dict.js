/* public/app/core/address-dict.js — Этап 2: локальный справочник адресов
   ADDR-PATCH v5 */
(function () {
  'use strict';

  var PLACES = {
    'янтарный':     { name: 'Янтарный',    fee: 200, zone: 1 },
    'синявино':     { name: 'Синявино',    fee: 250, zone: 2 },
    'покровское':   { name: 'Покровское',  fee: 250, zone: 2 },
    'куликово':     { name: 'Куликово',    fee: 300, zone: 3 },
    'яблоновка':    { name: 'Яблоновка',   fee: 300, zone: 3 }
  };

  var STREETS = {
    'янтарный': [
      'Советская', 'Озёрная', 'Морская', 'Пляжевая', 'Заводская',
      'Победы', 'Школьная', 'Центральная', 'Садовая', 'Калининградская',
      'Балтийская', 'Приморская', 'Синявинская', 'Подводников',
      'Янтарная', 'Морской бульвар', 'Зелёная', 'Луговая',
      'Лесная', 'Парковая', '(без улицы)'
    ],
    'синявино': [
      'Центральная', 'Лесная', 'Полевая', 'Садовая', 'Школьная',
      'Зелёная', 'Луговая', 'Озёрная', 'Молодёжная', 'Заречная',
      '(без улицы)'
    ],
    'покровское': [
      'Центральная', 'Советская', 'Октябрьская', 'Молодёжная',
      'Лесная', 'Полевая', 'Садовая', 'Школьная', 'Зелёная',
      '(без улицы)'
    ],
    'куликово': [
      'Центральная', 'Лесная', 'Садовая', 'Молодёжная', 'Полевая',
      '(без улицы)'
    ],
    'яблоновка': [
      'Центральная', 'Лесная', 'Садовая', 'Молодёжная',
      '(без улицы)'
    ]
  };

  function normPlace(raw) { return String(raw || '').toLowerCase().trim(); }

  function normStreet(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/^(ул\.?|улица|пер\.?|проезд|пр-д|бульвар|пл\.?)\s+/i, '')
      .replace(/\s+(ул\.?|улица|пер\.?|проезд|пр-д|бульвар|пл\.?)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getPlaceInfo(placeRaw) {
    var key = normPlace(placeRaw);
    return PLACES[key] || null;
  }
  function getFee(placeRaw) {
    var info = getPlaceInfo(placeRaw);
    return info ? info.fee : 0;
  }
  function getStreets(placeRaw) {
    var key = normPlace(placeRaw);
    return STREETS[key] || [];
  }
  function getAllPlaces() {
    return Object.keys(PLACES).map(function (k) { return PLACES[k].name; });
  }
  function isValidStreet(placeRaw, streetRaw) {
    if (!streetRaw) return true;
    var list = getStreets(placeRaw);
    if (!list.length) return true;
    var clean = normStreet(streetRaw);
    return list.some(function (s) {
      return normStreet(s) === clean || s === streetRaw;
    });
  }

  window.AddressModule = {
    PLACES: PLACES,
    STREETS: STREETS,
    LOCAL_STREETS: STREETS,
    normPlace: normPlace,
    normStreet: normStreet,
    getPlaceInfo: getPlaceInfo,
    getFee: getFee,
    getStreets: getStreets,
    getAllPlaces: getAllPlaces,
    isValidStreet: isValidStreet,
    populateStreets: function (placeRaw) {
      var list = getStreets(placeRaw);
      var input = document.getElementById('checkoutStreet');
      if (!input) return;
      var datalistId = input.getAttribute('list');
      var datalist = datalistId ? document.getElementById(datalistId) : null;
      if (datalist) {
        datalist.innerHTML = list.map(function (s) {
          return '<option value="' + s + '">';
        }).join('');
      }
    }
  };
})();
