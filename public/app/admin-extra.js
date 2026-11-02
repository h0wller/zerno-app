/* public/app/admin-extra.js — Ф3.20: админ-кластер — промо-лист, guard'ы кофейного меню,
брендовый хром (тикер/логотип). */
(function () {
  'use strict';

  /* ── список промокодов (модалка админа): кэш + чипы-фильтр ── */
  var promoCache = [];
  var promoFilter = 'all';

  function promoRow(p) {
    var exp = p.expires
      ? new Date(p.expires).toLocaleDateString('ru-RU')
      : 'бессрочно';
    var dead = p.expires && new Date(p.expires) < new Date();
    var kind =
      p.kind === 'stamp'
        ? '+' + p.value + ' штамп(а) 🌊'
        : p.kind === 'free'
          ? '+' + p.value + ' кофе 🌊'
          : p.kind === 'freeship'
            ? 'бесплатная доставка 🛵'
            : p.kind === 'percent'
              ? '−' + p.value + '% 🍕'
              : '−' + p.value + ' ₽ 🍕';
    return (
      '<div class="logrow" style="align-items:center;gap:8px;flex-wrap:wrap">' +
      '<span class="lt">' +
      esc(p.code) +
      '</span>' +
      '<span style="flex:1;min-width:150px">' +
      kind +
      ' · ' +
      (dead ? 'истёк' : 'до ' + exp) +
      ' · лимит ' +
      (p.maxuses || '∞') +
      ' · исп. ' +
      p.uses +
      (p.owner ? ' · 🤖 авто' : '') +
      '</span>' +
      '<button class="btn ghost" data-pt="' +
      p.id +
      '">' +
      (p.active ? 'Выкл' : 'Вкл') +
      '</button>' +
      '<button class="btn ghost danger" data-pd="' +
      p.id +
      '">🗑</button></div>'
    );
  }

  function paintPromoList() {
    var list = document.getElementById('pmList');
    var chips = document.getElementById('pmChips');
    if (!list) return;
    var auto = promoCache.filter(function (p) { return p.owner; });
    var manual = promoCache.filter(function (p) { return !p.owner; });
    var shown =
      promoFilter === 'auto'
        ? auto
        : promoFilter === 'manual'
          ? manual
          : promoCache;
    if (chips) {
      chips.innerHTML = [
        ['all', 'Все', promoCache.length],
        ['manual', 'Ручные', manual.length],
        ['auto', 'Авто', auto.length]
      ]
        .map(function (c) {
          return (
            '<button type="button" class="pm-chip' +
            (promoFilter === c[0] ? ' on' : '') +
            '" data-pf="' +
            c[0] +
            '">' +
            c[1] +
            ' · ' +
            c[2] +
            '</button>'
          );
        })
        .join('');
    }
    list.innerHTML =
      shown.map(promoRow).join('') ||
      '<div class="hmini">Пока пусто — создайте первый код</div>';
  }

  var chipsHost = document.getElementById('pmChips');
  if (chipsHost) {
    chipsHost.addEventListener('click', function (e) {
      var c = e.target.closest('[data-pf]');
      if (!c) return;
      promoFilter = c.getAttribute('data-pf') || 'all';
      paintPromoList();
    });
  }

  window.loadPromos = async function () {
    try {
      var r = await api('/promos');
      promoCache = Array.isArray(r.promos) ? r.promos : [];
      paintPromoList();
    } catch (e) {}
  };

  /* ── guard'ы: не рисуем кофейное меню, пока MENU не загружен ── */
  if (typeof renderMenu === 'function') {
    renderMenu = (function (_rm) {
      return function () {
        if (typeof MENU === 'undefined' || !Array.isArray(MENU)) return;
        return _rm.apply(this, arguments);
      };
    })(renderMenu);
  }
  if (typeof renderRail === 'function') {
    renderRail = (function (_rr) {
      return function () {
        if (typeof MENU === 'undefined' || !Array.isArray(MENU)) return;
        return _rr.apply(this, arguments);
      };
    })(renderRail);
  }
  if (typeof loadMenu === 'function') {
    loadMenu = (function (_lm) {
      return async function () {
        var r = await _lm.apply(this, arguments);
        try {
          if (brand === 'coffee') {
            renderRail();
            renderMenu();
          }
        } catch (e) {}
        return r;
      };
    })(loadMenu);
  }

  /* ── R5: тикер и логотип по бренду ── */
  var __chromeLast = null;

  var tickerResizeObserver = null;
  var tickerResizeBound = false;
  var tickerReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function syncTickerMotion(track) {
    var box = track && track.closest('.ticker');
    var viewport = box && box.querySelector('.tickerViewport');
    var group = track && track.querySelector('.tickerGroup:not([aria-hidden="true"])');
    var toggle = box && box.querySelector('#tickerToggle');
    if (!box || !viewport || !group || !toggle) return;

    var reduced = tickerReducedMotion && tickerReducedMotion.matches;
    var overflowing = !reduced && group.scrollWidth * 2 > viewport.clientWidth + 1;
    var clone = track.querySelector('.tickerGroup[aria-hidden="true"]');

    if (overflowing && !clone) {
      clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    } else if (!overflowing && clone) {
      clone.remove();
    }

    box.classList.toggle('is-overflowing', overflowing);
    toggle.hidden = !overflowing;
    if (!overflowing || !box.classList.contains('is-paused')) {
      box.classList.remove('is-paused');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Приостановить прокрутку объявлений');
      toggle.querySelector('span').textContent = 'Ⅱ';
    }
  }

  function bindTickerMotion(track) {
    var box = track.closest('.ticker');
    var viewport = box && box.querySelector('.tickerViewport');
    var group = track.querySelector('.tickerGroup:not([aria-hidden="true"])');
    var toggle = box && box.querySelector('#tickerToggle');
    if (!box || !viewport || !group || !toggle) return;

    if (!toggle.dataset.motionBound) {
      toggle.addEventListener('click', function () {
        var paused = box.classList.toggle('is-paused');
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.setAttribute(
          'aria-label',
          paused ? 'Возобновить прокрутку объявлений' : 'Приостановить прокрутку объявлений'
        );
        toggle.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
      });
      toggle.dataset.motionBound = 'true';
    }

    if (tickerResizeObserver) tickerResizeObserver.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      tickerResizeObserver = new ResizeObserver(function () {
        syncTickerMotion(track);
      });
      tickerResizeObserver.observe(viewport);
      tickerResizeObserver.observe(group);
    }
    if (!tickerResizeBound) {
      window.addEventListener('resize', function () {
        var current = document.getElementById('tickerTrack');
        if (current) syncTickerMotion(current);
      });
      if (tickerReducedMotion) {
        tickerReducedMotion.addEventListener('change', function () {
          var current = document.getElementById('tickerTrack');
          if (current) syncTickerMotion(current);
        });
      }
      tickerResizeBound = true;
    }
    requestAnimationFrame(function () {
      syncTickerMotion(track);
    });
  }

  function renderTickerItems(bConfig) {
    var track = document.getElementById('tickerTrack');
    if (!track) return;
    var rawList = Array.isArray(bConfig.ticker) ? bConfig.ticker.slice() : [];
    if (
      typeof brand !== 'undefined' &&
      brand === 'delivery' &&
      window.deliveryInfo
    ) {
      var wp = window.deliveryInfo.weekPromo;
      var pm = window.deliveryInfo.pizzaMonth;
      var promoItems = [];
      if (wp && wp.text && String(wp.text).trim()) {
        promoItems.push('🎁 ' + String(wp.text).trim());
      } else if (wp && wp.gift && Number(wp.threshold) > 0) {
        promoItems.push(
          '🎁 Каждые ' + wp.threshold + ' ₽ в чеке — ' + wp.gift + ' в подарок'
        );
      }
      if (pm && pm.name && String(pm.name).trim()) {
        promoItems.push(
          '🍕 2 пиццы 35 см → «' + String(pm.name).trim() + '» в подарок'
        );
      }
      if (promoItems.length) {
        rawList = promoItems.concat(
          rawList.filter(function (x) {
            return !/в подарок/i.test(String(x || ''));
          })
        );
      }
    }
    var L = rawList
      .map(function (x) {
        return String(x || '').trim();
      })
      .filter(Boolean);
    var tickerBox = track.closest('.ticker');
    if (tickerBox) {
      tickerBox.classList.toggle('is-empty', !L.length);
      tickerBox.classList.remove('is-overflowing', 'is-paused');
    }
    track.innerHTML = L.length
      ? '<div class="tickerGroup">' +
        L.map(function (x) {
          return '<span class="ti">' + x + '</span>';
        }).join('') +
        '</div>'
      : '';
    if (!L.length) {
      if (tickerResizeObserver) tickerResizeObserver.disconnect();
      var tickerToggle = tickerBox && tickerBox.querySelector('#tickerToggle');
      if (tickerToggle) {
        tickerToggle.hidden = true;
        tickerToggle.setAttribute('aria-pressed', 'false');
        tickerToggle.setAttribute('aria-label', 'Приостановить прокрутку объявлений');
        tickerToggle.querySelector('span').textContent = 'Ⅱ';
      }
      return;
    }
    bindTickerMotion(track);
  }

  function applyBrandChrome(force) {
    if (!force && __chromeLast === brand) return;
    __chromeLast = brand;

    var bConfig =
      typeof window.BRANDS !== 'undefined'
        ? window.BRANDS[brand] || window.BRANDS.coffee
        : {
            ticker: ['…и кофе'],
            logo: { src: '/andCoffee.svg', w: 42, h: 42, alt: '…и кофе' },
            emoji: '☕'
          };

    if (brand === 'delivery' && !window.deliveryInfo && typeof window.refreshDeliveryInfo === 'function') {
      window.refreshDeliveryInfo().catch(function () {});
    }
    renderTickerItems(bConfig);

    var mark =
      document.getElementById('brandMark') ||
      document.querySelector('.topbar .brand .mark');
    if (mark) {
      var lg = bConfig.logo || {
        src: '/andCoffee.svg',
        w: 42,
        h: 42,
        alt: '…и кофе'
      };
      mark.innerHTML =
        '<img class="brandLogo" id="brandLogoImg" src="' +
        lg.src +
        '" alt="' +
        lg.alt +
        '"' +
        ' width="' +
        lg.w +
        '" height="' +
        lg.h +
        '"' +
        ' decoding="async" fetchpriority="high"' +
        ' onerror="this.outerHTML=\'<span style=&quot;font-size:26px&quot;>' +
        (bConfig.emoji || '☕') +
        '</span>\'">';
    }
  }

  window.applyBrandChrome = applyBrandChrome;
  var bs = document.getElementById('brandSeg');
  if (bs) {
    bs.addEventListener('click', function () {
      setTimeout(function () {
        applyBrandChrome(true);
      }, 60);
    });
  }

  /* Согласие регистрации управляется модулем auth.js и разметкой authModal. */
})();

if (typeof window.applyBrandChrome === 'function') window.applyBrandChrome();
setTimeout(function () {
  if (typeof window.applyBrandChrome === 'function') window.applyBrandChrome();
}, 400);