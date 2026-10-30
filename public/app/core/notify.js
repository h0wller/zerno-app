/* public/app/core/notify.js — единое управление каналами уведомлений профиля. */
(function () {
    'use strict';

    function syncNotifyAll() {
        if (!me) return;
        var telegram = document.getElementById('ntTg2');
        var browser = document.getElementById('ntWeb2');
        if (telegram) telegram.checked = me.notify_tg !== 0;
        if (browser) browser.checked = me.notify_web !== 0;
    }

    async function applyNotify(telegram, browser) {
        if (!me) return;
        try {
            var response = await api('/me/notify', {
                method: 'PUT',
                body: { tg: telegram ? 1 : 0, web: browser ? 1 : 0 }
            });
            if (response && response.customer) {
                me.notify_tg = response.customer.notify_tg;
                me.notify_web = response.customer.notify_web;
            } else {
                me.notify_tg = telegram ? 1 : 0;
                me.notify_web = browser ? 1 : 0;
            }
            syncNotifyAll();
            var channels = telegram && browser ? 'Telegram и браузер'
                : telegram ? 'Telegram'
                : browser ? 'браузер'
                : 'ни один канал';
            toast('Настройки уведомлений сохранены: ' + channels + '.', '🔔');
        } catch (error) {
            syncNotifyAll();
            toast(error.message, '⚠️');
        }
    }

    window.syncNotifyAll = syncNotifyAll;
    window.syncNotifyUI = syncNotifyAll;
    window.applyNotify = applyNotify;

    setTimeout(syncNotifyAll, 400);
})();
