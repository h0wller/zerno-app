/* public/app/profile-orders.js — заказы гостя: единая загрузка и отображение. */
(function () {
    'use strict';
    var ordersCache = null, ordersCacheAt = 0, ordersCacheUser = null;
    var ordersRequests = new Map(), ordersModalOpener = null;
    var cacheTtl = 20000;

    function currentUserKey() {
        var user = window.me;
        return user ? String(user.id || user.phone || '') : null;
    }

    function resetOrdersCacheForUser(userKey) {
        if (ordersCacheUser === userKey) return;
        ordersCache = null;
        ordersCacheAt = 0;
        ordersCacheUser = userKey;
        window.__lastMineOrders = [];
        var host = document.getElementById('myOrders');
        if (host) host.innerHTML = '<div class="hmini">Загрузка заказа…</div>';
        var list = document.getElementById('omList');
        if (list && document.getElementById('ordersModal')?.classList.contains('show')) {
            list.innerHTML = '<div class="hmini">Загрузка заказов…</div>';
        }
    }

    function fetchMyOrders(force) {
        var userKey = currentUserKey();
        if (userKey === null) return Promise.resolve([]);
        resetOrdersCacheForUser(userKey);
        if (!force && ordersCache && ordersCacheUser === userKey && Date.now() - ordersCacheAt < cacheTtl) {
            return Promise.resolve(ordersCache);
        }
        var pending = ordersRequests.get(userKey);
        if (pending) return pending;

        var request = api('/orders/mine').then(function (response) {
            var result = Array.isArray(response.orders) ? response.orders : [];
            if (currentUserKey() === userKey) {
                ordersCache = result;
                ordersCacheAt = Date.now();
                ordersCacheUser = userKey;
                window.__lastMineOrders = result;
            }
            return result;
        }).finally(function () {
            if (ordersRequests.get(userKey) === request) ordersRequests.delete(userKey);
        });
        ordersRequests.set(userKey, request);
        return request;
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
            ? '<button type="button" class="moTrack" data-open-track="' + esc(String(order.id)) + '" aria-label="Открыть статус и детали заказа">Статус заказа</button>' : '';
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
        if (!host || !window.me) return;
        if (window.brand !== 'delivery') { host.innerHTML = ''; return; }
        var userKey = currentUserKey();
        try {
            var orders = await fetchMyOrders(!!(options && options.force));
            if (currentUserKey() !== userKey) return;
            host.innerHTML = orders.length ? renderOrder(orders[0], true)
                : '<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';
        } catch (_) {
            if (currentUserKey() !== userKey) return;
            host.innerHTML = '<div class="hmini">Не удалось загрузить последний заказ</div>';
        }
    }

    async function renderOrdersModal(options) {
        var modal = document.getElementById('ordersModal');
        var list = document.getElementById('omList');
        if (!modal || !list || !window.me) return;
        if (!modal.classList.contains('show')) {
            ordersModalOpener = document.activeElement;
            modal.classList.add('show');
            var closeButton = modal.querySelector('.omClose');
            if (closeButton) closeButton.focus();
            if (typeof window.syncOverlay === 'function') window.syncOverlay();
        }
        var userKey = currentUserKey();
        if (!ordersCache) list.innerHTML = '<div class="hmini">Загрузка заказов…</div>';
        try {
            var orders = await fetchMyOrders(!!(options && options.force));
            if (currentUserKey() !== userKey) return;
            list.innerHTML = orders.map(function (order) { return renderOrder(order, false); }).join('') ||
                '<div class="hmini">Заказов пока нет 🍕</div>';
        } catch (_) {
            if (currentUserKey() !== userKey) return;
            list.innerHTML = '<div class="hmini">Не удалось загрузить заказы. Попробуйте открыть список ещё раз.</div>';
        }
    }

    function updateMyOrdersCache(orders) {
        var userKey = currentUserKey();
        if (userKey === null) return;
        resetOrdersCacheForUser(userKey);
        ordersCache = Array.isArray(orders) ? orders : [];
        ordersCacheAt = Date.now();
        ordersCacheUser = userKey;
        window.__lastMineOrders = ordersCache;
    }

    function invalidateMyOrders() { ordersCache = null; ordersCacheAt = 0; }
    Object.assign(window, {
        loadMyOrders: loadMyOrders,
        renderOrdersModal: renderOrdersModal,
        updateMyOrdersCache: updateMyOrdersCache,
        invalidateMyOrders: invalidateMyOrders
    });

    (function createOrdersModal() {
        if (document.getElementById('ordersModal')) return;
        var modal = document.createElement('div');
        modal.id = 'ordersModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'ordersModalTitle');
        modal.innerHTML = '<div class="omCard" tabindex="-1"><button type="button" class="omClose" aria-label="Закрыть список заказов">✕ Закрыть</button><h3 id="ordersModalTitle" style="margin:0 0 12px">📦 Мои заказы</h3><div id="omList" aria-live="polite"></div></div>';
        document.body.appendChild(modal);

        function close() {
            modal.classList.remove('show');
            if (typeof window.syncOverlay === 'function') window.syncOverlay();
            if (ordersModalOpener && ordersModalOpener.isConnected) ordersModalOpener.focus();
            ordersModalOpener = null;
        }

        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.closest('.omClose')) close();
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = Array.prototype.slice.call(modal.querySelectorAll(
                'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(function (element) { return !element.closest('[hidden]'); });
            if (!focusable.length) return;
            var first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        // После закрытия вложенного трекера фокус может остаться на скрытой кнопке.
        // Ловим Escape на document, но не закрываем список поверх открытого трекера.
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape' || !modal.classList.contains('show')
                || document.querySelector('#orderTrackModal.show')) return;
            event.preventDefault();
            event.stopPropagation();
            close();
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
