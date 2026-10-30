/* public/app/profile-orders.js — заказы гостя: единая загрузка и отображение. */
(function () {
    'use strict';
    var ordersCache = null, ordersCacheAt = 0, ordersRequest = null, cacheTtl = 20000;

    function fetchMyOrders(force) {
        if (!me) return Promise.resolve([]);
        if (!force && ordersCache && Date.now() - ordersCacheAt < cacheTtl) return Promise.resolve(ordersCache);
        if (ordersRequest) return ordersRequest;
        ordersRequest = api('/orders/mine').then(function (response) {
            ordersCache = Array.isArray(response.orders) ? response.orders : [];
            ordersCacheAt = Date.now();
            window.__lastMineOrders = ordersCache;
            return ordersCache;
        }).finally(function () { ordersRequest = null; });
        return ordersRequest;
    }

    function statusFor(status) {
        var statuses = {
            new: ['🆕', 'mo-new', 'Новый'], accept: ['✅', 'mo-accept', 'Подтверждён'],
            cook: ['👨‍🍳', 'mo-cook', 'Готовится'], way: ['🛵', 'mo-way', 'Курьер в пути'],
            done: ['🏁', 'mo-done', 'Выполнен'], cancel: ['❌', 'mo-cancel', 'Отменён']
        };
        return statuses[status] || ['•', 'mo-new', String(status || 'Статус неизвестен')];
    }

    function renderOrder(order, compact) {
        var status = statusFor(order.status);
        var date = new Date(order.created);
        var dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
        var items = (Array.isArray(order.items) ? order.items : []).map(function (item) {
            return (Number(item.qty) || 1) + '× ' + esc(item.name || 'Позиция');
        }).join(', ');
        var time = order.is_preorder
            ? ' · <span class="preorder-slot">⏰ Предзаказ: ' + esc(order.slot || '') + '</span>'
            : (order.eta ? ' · <span>⏰ ' + esc(order.eta) + '</span>' : '');
        var track = !['done', 'cancel'].includes(order.status)
            ? '<button type="button" class="moTrack" data-open-track="' + esc(String(order.id)) + '">📍 Отследить</button>' : '';
        return '<article class="myOrderCard' + (compact ? ' is-compact' : '') + '">' +
            '<div class="moTop"><span>Заказ #' + esc(String(order.no || order.id || '')) +
            (dateText ? ' <span class="moDate">· ' + dateText + '</span>' : '') + '</span>' +
            '<span class="moSt ' + status[1] + '">' + status[0] + ' ' + esc(status[2]) + '</span></div>' +
            '<div class="moSum">' + fmt(order.total) + time + '</div>' +
            (items ? '<div class="moItems">' + items + '</div>' : '') +
            ((Array.isArray(order.gifts) && order.gifts.length) ? '<div class="moGifts">🎁 ' +
                order.gifts.map(function (gift) { return esc(gift.name || 'Подарок') + ' ×' + (Number(gift.qty) || 1); }).join(', ') + '</div>' : '') +
            track + '</article>';
    }

    async function loadMyOrders(options) {
        var host = document.getElementById('myOrders');
        if (!host || !me) return;
        if (typeof brand !== 'undefined' && brand !== 'delivery') { host.innerHTML = ''; return; }
        try {
            var orders = await fetchMyOrders(!!(options && options.force));
            host.innerHTML = orders.length ? renderOrder(orders[0], true)
                : '<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';
        } catch (_) {
            if (!host.innerHTML) host.innerHTML = '<div class="hmini">Не удалось загрузить последний заказ</div>';
        }
    }

    async function renderOrdersModal(options) {
        var modal = document.getElementById('ordersModal');
        var list = document.getElementById('omList');
        if (!modal || !list || !me) return;
        modal.classList.add('show');
        if (typeof window.syncOverlay === 'function') window.syncOverlay();
        if (!ordersCache) list.innerHTML = '<div class="hmini">Загрузка заказов…</div>';
        try {
            var orders = await fetchMyOrders(!!(options && options.force));
            list.innerHTML = orders.map(function (order) { return renderOrder(order, false); }).join('') ||
                '<div class="hmini">Заказов пока нет 🍕</div>';
        } catch (_) {
            list.innerHTML = '<div class="hmini">Не удалось загрузить заказы. Попробуйте открыть список ещё раз.</div>';
        }
    }

    function invalidateMyOrders() { ordersCache = null; ordersCacheAt = 0; }
    Object.assign(window, { loadMyOrders: loadMyOrders, renderOrdersModal: renderOrdersModal, invalidateMyOrders: invalidateMyOrders });

    (function createOrdersModal() {
        if (document.getElementById('ordersModal')) return;
        var modal = document.createElement('div');
        modal.id = 'ordersModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'ordersModalTitle');
        modal.innerHTML = '<div class="omCard" tabindex="-1"><button type="button" class="omClose" aria-label="Закрыть список заказов">✕ Закрыть</button><h3 id="ordersModalTitle" style="margin:0 0 12px">📦 Мои заказы</h3><div id="omList" aria-live="polite"></div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.closest('.omClose')) {
                modal.classList.remove('show');
                if (typeof window.syncOverlay === 'function') window.syncOverlay();
                var opener = document.getElementById('myOrdersBtn');
                if (opener) opener.focus();
            }
        });
    })();

    document.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('[data-open-track]') : null;
        if (!button) return;
        event.preventDefault();
        var order = (window.__lastMineOrders || []).find(function (item) {
            return String(item.id) === String(button.getAttribute('data-open-track'));
        });
        if (order && typeof window.openOrderTrackModal === 'function') window.openOrderTrackModal(order);
    });
})();
