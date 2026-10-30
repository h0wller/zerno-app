/* public/app/profile-orders.js — список заказов и модалка «Мои заказы». */
(function () {
'use strict';

    async function loadMyOrders() {
        var host = document.getElementById('myOrders');
        if (!host || !me) return;
        if (typeof brand !== 'undefined' && brand !== 'delivery') {
            host.innerHTML = '';
            return;
        }
        try {
            var r = await api('/orders/mine');
            window.__lastMineOrders = r.orders || []; /* Ф3.69: единый кэш для делегата [data-open-track] */
            var ST = {
                new: ['🆕', 'mo-new', 'Новый'],
                accept: ['✅', 'mo-accept', 'Подтверждён'],
                cook: ['👨‍🍳', 'mo-cook', 'Готовится'],
                way: ['🛵', 'mo-way', 'Курьер в пути'],
                done: ['🏁', 'mo-done', 'Выполнен'],
                cancel: ['❌', 'mo-cancel', 'Отменён']
            };
            var o = (r.orders || [])[0];
            if (!o) {
                host.innerHTML = '<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';
            } else {
                var s = ST[o.status] || ['•', 'mo-new', o.status];
                var d = new Date(o.created).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
                var items = (o.items || []).slice(0, 3).map(function (i) { return i.qty + '× ' + i.name; }).join(', ') + ((o.items || []).length > 3 ? '…' : '');

                var timeInfo = o.is_preorder
                    ? ' · <span class="preorder-slot" data-slot="' + esc(o.slot) + '" style="color:#B26A05;font-weight:700">⏰ Предзаказ: ' + esc(o.slot) + '</span>'
                    : (o.eta ? ' · <span>⏰ ' + esc(o.eta) + '</span>' : '');

                host.innerHTML = '<div class="myOrderCard"><div class="moTop"><span>Заказ #' + o.no + ' <span class="moDate">· ' + d + '</span></span><span class="moSt ' + s[1] + '">' + s[0] + ' ' + s[2] + '</span></div>' +
                    '<div class="moSum">' + fmt(o.total) + timeInfo + '</div>' +
                    (items ? '<div class="moItems">' + esc(items) + '</div>' : '') +
                    ((o.gifts && o.gifts.length) ? '<div class="moGifts">🎁 ' + o.gifts.map(function (g) { return esc(g.name) + ' ×' + g.qty; }).join(', ') + '</div>' : '') +
                    /* Ф3.69: кнопка «Отследить» для активных заказов */
                    (!['done', 'cancel'].includes(o.status) ? '<button type="button" class="moTrack" data-open-track="' + esc(String(o.id)) + '">📍 Отследить</button>' : '') + '</div>';
            }
        } catch (e) { }
        if (typeof window.applyProfileBrand === 'function') window.applyProfileBrand();
    }

    async function renderOrdersModal() {
        var list = document.getElementById('omList');
        if (!list || !me) return;
        list.innerHTML = '<div class="hmini">Загрузка…</div>';
        document.getElementById('ordersModal').classList.add('show');
        if (typeof window.syncOverlay === 'function') window.syncOverlay();
        try {
            var r = await api('/orders/mine');
            window.__lastMineOrders = r.orders || []; /* Ф3.69: кэш списка для кнопки «Отследить» */
            var ST = {
                new: '🆕 Новый',
                accept: '✅ Подтверждён',
                cook: '👨‍🍳 Готовится',
                way: '🛵 Курьер в пути',
                done: '🏁 Выполнен',
                cancel: '❌ Отменён'
            };

            list.innerHTML = (r.orders || []).map(function (o) {
                var d = new Date(o.created).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
                // СТАЛО:
                var timeInfo = o.is_preorder
                    ? ' · <b class="preorder-marker" data-preorder-slot="' + esc(o.slot) + '" style="color:#B26A05">⏰ Предзаказ: ' + esc(o.slot) + '</b>'
                    : (o.eta ? ' · ⏰ ' + esc(o.eta) : '');

                return '<div class="myOrderCard" style="margin-bottom:8px"><div class="moTop"><span>Заказ #' + o.no + ' <span class="moDate">· ' + d + '</span></span><span class="moSt">' + (ST[o.status] || o.status) + '</span></div>' +
                    '<div class="moSum">' + fmt(o.total) + timeInfo + '</div>' +
                    '<div class="moItems">' + esc(o.items.map(function (i) { return i.qty + '× ' + i.name; }).join(', ')) + '</div>' +
                    ((o.gifts && o.gifts.length) ? '<div class="moGifts">🎁 ' + o.gifts.map(function (g) { return esc(g.name) + ' ×' + g.qty; }).join(', ') + '</div>' : '') +
                    /* Ф3.69: кнопка «Отследить» для активных заказов в модалке */
                    (!['done', 'cancel'].includes(o.status) ? '<button type="button" class="moTrack" data-open-track="' + esc(String(o.id)) + '">📍 Отследить</button>' : '') + '</div>';
            }).join('') || '<div class="hmini">Заказов пока нет 🍕</div>';
        } catch (e) {
            list.innerHTML = '<div class="hmini">Не загрузилось</div>';
        }
    }

    Object.assign(window, { loadMyOrders, renderOrdersModal });
})();

(function () {
    if (document.getElementById('ordersModal')) return;
    var m = document.createElement('div');
    m.id = 'ordersModal';
    m.innerHTML = '<div class="omCard"><button type="button" class="omClose">✕ Закрыть</button><h3 style="margin:0 0 12px">📦 Мои заказы</h3><div id="omList"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
        if (e.target === m || e.target.closest('.omClose')) {
            m.classList.remove('show');
            if (typeof window.syncOverlay === 'function') window.syncOverlay();
        }
    });
})();

(function () {
    var pb = document.getElementById('profileBox');
    if (pb && !document.getElementById('myOrdersBtn')) {
        var b = document.createElement('button');
        b.type = 'button';
        b.id = 'myOrdersBtn';
        b.className = 'demoBtn';
        b.textContent = '📦 Мои заказы';
        var mo = document.getElementById('myOrders');
        if (mo) pb.insertBefore(b, mo);
        else pb.appendChild(b);
    }
})();

document.addEventListener('click', function (e) {
    var btn = e.target.closest('#myOrdersBtn, [data-tab="my-orders"], .my-orders-btn');
    if (!btn && e.target.closest('button')) {
        var b = e.target.closest('button');
        if (/мои заказы/i.test(b.textContent || '')) btn = b;
    }
    if (btn) {
        e.preventDefault();
        var m = document.getElementById('ordersModal');
        if (m && m.parentElement !== document.body) {
            document.body.appendChild(m);
        }
        if (typeof window.renderOrdersModal === 'function') {
            window.renderOrdersModal();
        }
    }
});

/* DOM-блок выше создаёт ordersModal и кнопку myOrdersBtn; открытием управляет core/panel.js. */

/* Ф3.69: делегированный клик «Отследить заказ» (#myOrders и модалка «Мои заказы»).
   Заказ ищем в кэше window.__lastMineOrders, который обновляется при каждом рендере списка. */
document.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('[data-open-track]') : null;
  if (!btn) return;
  e.preventDefault();
  var id = btn.getAttribute('data-open-track');
  var found = (window.__lastMineOrders || []).find(function (x) { return String(x.id) === String(id); });
  if (found && typeof window.openOrderTrackModal === 'function') window.openOrderTrackModal(found);
});
