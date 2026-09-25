/* public/app/profile.js — F2.2: профиль гостя, бонусы, верификация */
var cupWord = n => n === 1 ? 'чашка' : (n > 0 && n < 5 ? 'чашки' : 'чашек');
var BEAN = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<g transform="rotate(-24 12 12)">' +
    '<ellipse cx="12" cy="12" rx="7.7" ry="9.8" fill="currentColor"/>' +
    '<path d="M12 3.6 C 8.4 7.8 15.6 16.2 12 20.4" ' +
      'fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.5" ' +
      'stroke-linecap="round"/>' +
    '<ellipse cx="9.2" cy="8.2" rx="1.6" ry="2.8" fill="rgba(255,255,255,.25)"/>' +
  '</g></svg>';
var stampIcon = i => i === 9 ? '☕' : BEAN;

(function () {
    'use strict';

    var _meResolved = false;
    var _meWaiters = [];

    function _onMeResolved(fn) {
        if (_meResolved) { try { fn(); } catch (e) { console.error(e); } return; }
        _meWaiters.push(fn);
    }

    function _resolveMeReady() {
        if (_meResolved) return;
        _meResolved = true;
        var queue = _meWaiters.splice(0);
        queue.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    }
    window.__profileMeReady = _resolveMeReady;

    (function autoResolveMe() {
        var started = Date.now();
        var hasToken = false;
        try { hasToken = (typeof USER_TOKEN !== 'undefined' && !!USER_TOKEN); } catch (_) {}
        if (!hasToken) {
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (!k || !/token|auth|jwt/i.test(k)) continue;
                    var v = localStorage.getItem(k);
                    if (v && v.length > 8) { hasToken = true; break; }
                }
            } catch (_) {}
        }
        var timeout = hasToken ? 3000 : 300;
        var tick = function () {
            if (_meResolved) return;
            var loaded = false;
            try { loaded = (typeof me !== 'undefined') && me !== null; } catch (_) {}
            if (loaded || Date.now() - started > timeout) return _resolveMeReady();
            setTimeout(tick, 100);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 20); }, { once: true });
        } else {
            setTimeout(tick, 20);
        }
    })();

    /* ── бонусы ── */
    function renderBonus() {
        if (!_meResolved) {
            var noUserEl = document.getElementById('bonusNoUser');
            var boxEl = document.getElementById('bonusBox');
            if (noUserEl) noUserEl.hidden = true;
            if (boxEl) boxEl.hidden = true;
            _onMeResolved(function () { try { renderBonus(); } catch (e) {} });
            return;
        }
        $("#bonusNoUser").hidden = !!me;
        $("#bonusBox").hidden = !me;
        if (!me) return;
        let h = "";
        for (let i = 0; i < 10; i++)
            h +=
                i < me.stamps
                    ? `<div class="stamp f ${i === me.stamps - 1 ? "last" : ""}">${stampIcon(i)}</div>`
                    : i === me.stamps && !me.free
                        ? `<div class="stamp n"></div>`
                        : `<div class="stamp e"></div>`;
        $("#stampGrid").innerHTML = h;
        $("#bonusProg").innerHTML =
            me.free > 0
                ? `У вас <b>${me.free} бесплатный(х) кофе</b> 🎉`
                : `До бесплатного кофе: <b>${10 - me.stamps} ${cupWord(10 - me.stamps)}</b> из 10`;
        $("#freeSlot").innerHTML =
            me.free > 0
                ? `<div class="freeCard"><span class="fe">🎁</span>
<div><b>Кофе за наш счёт ×${me.free}</b><small>Покажите этот экран кассиру</small></div></div>`
                : "";
        const burnBtn = $("#burnFree");
        if (burnBtn)
            burnBtn.onclick = async () => {
                try {
                    const r = await api("/redeem", { method: "POST" });
                    me = r.customer;
                    renderBonus();
                    renderProfile();
                    toast("Бесплатный кофе погашен. Вкусного!", "☕");
                } catch (e) {
                    toast(e.message, "⚠️");
                }
            };
        $("#mbonusSt").textContent = `${me.stamps}/10`;
        const mbf = $("#mbonusFree");
        if (mbf) {
            mbf.hidden = me.free < 1;
            mbf.textContent = `🎁 подарок: ${me.free}`;
        }
        setTimeout(() => {
            if (me && me.qr) {
                const qm = document.getElementById('qrMini');
                const qmain = document.getElementById('qrMain');
                if (qm && typeof drawQR === 'function') drawQR(qm, me.qr);
                if (qmain && typeof drawQR === 'function') drawQR(qmain, me.qr);
            }
        }, 50);
    }

    /* ── профиль ── */
    var _rpRunning = false;
    function renderProfile() {
        if (_rpRunning) return;
        _rpRunning = true;
        try {
            if (!_meResolved) {
                var pnu = document.getElementById('profileNoUser');
                var pbx = document.getElementById('profileBox');
                if (pnu) pnu.hidden = true;
                if (pbx) pbx.hidden = true;
                _onMeResolved(function () { try { renderProfile(); } catch (e) {} });
                return;
            }
            $("#profileNoUser").hidden = !!me;
            $("#profileBox").hidden = !me;
            if (!me) {
                $("#avInit").textContent = "?";
                $("#profileTopBtn").textContent = "?";
                return;
            }
            $("#avInit").textContent = (me.name[0] || "Г").toUpperCase();
            $("#profileTopBtn").textContent = (me.name[0] || "Г").toUpperCase();
            $("#nameInput").value = me.name;
            $("#phoneLbl").textContent = me.phone + " · вход по номеру";
            $("#chatsToggle2").hidden = !(
                me &&
                (me.role === "admin" || me.role === "cashier")
            );
            const r = me.role || "guest";
            $("#roleLbl").textContent =
                r === "admin"
                    ? "🔑 роль: администратор"
                    : r === "cashier"
                        ? "🧾 роль: кассир"
                        : "роль: гость";
            $("#activateBtn").hidden = !(r === "guest" || r === "cashier");
            $("#activateBtn").textContent =
                r === "guest"
                    ? "🔑 У меня код доступа сотрудника"
                    : "🔑 Повысить до администратора";
            refreshPushBtn();
            const spb2 = $("#setPinBtn");
            if (spb2) spb2.hidden = !me;
            $("#dashToggle").hidden = !(me && me.role === "admin");
            $("#stCups").textContent = me.cups;
            $("#stStamps").textContent = me.stamps + "/10";
            $("#stFree").textContent = me.free;
            $("#histList").innerHTML =
                (me.history || [])
                    .slice(0, 8)
                    .map(
                        (h) =>
                            `<div class="hmini"><b>${fmtTs(h.ts)}</b> · ${esc(h.a)} <i>— ${esc(h.by)}</i></div>`,
                    )
                    .join("") || '<div class="hmini">История пока пуста</div>';

            if (typeof window.syncBrandViews === "function") window.syncBrandViews();
        } finally {
            _rpRunning = false;
        }
    }

    /* ── блок верификации под кнопкой PIN ── */
    var _verifyNoteQueued = false;
    function renderVerifyNote() {
        if (!_meResolved) {
            var existing = document.getElementById('verifyNote');
            if (existing) existing.hidden = true;
            var actBtn0 = document.getElementById('activateBtn');
            if (actBtn0) actBtn0.hidden = true;
            if (!_verifyNoteQueued) {
                _verifyNoteQueued = true;
                _onMeResolved(function () {
                    _verifyNoteQueued = false;
                    try { renderVerifyNote(); } catch (e) {}
                });
            }
            return;
        }

        let n = $("#verifyNote");
        const pb = $("#profileBox");
        if (!pb) return;

        if (!n) {
            n = document.createElement("div");
            n.id = "verifyNote";
            pb.insertBefore(n, pb.firstChild);
        }

        const isStaff = me && me.role && me.role !== 'guest';
        const isVerified = me && (me.verified === true || me.verified === 1 || me.verified > 0);
        const isAlreadyActive = !me || isStaff || isVerified;

        if (isAlreadyActive) {
            n.hidden = true;
            n.innerHTML = "";
            const actBtn = document.getElementById('activateBtn');
            if (actBtn) actBtn.hidden = true;
            return;
        }

        let html = '<small style="color:#8A4B2A;background:#FFF6F0;border:1.5px dashed #E4B49A;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">🧾 Кассир назовёт 4 цифры кода активации — введите их:</small>' +
                '<div style="display:flex;gap:8px;margin-bottom:12px">' +
                '<input id="actCode" inputmode="numeric" maxlength="4" placeholder="Код" style="flex:1">' +
                '<button class="btn fire" id="actBtn">Активировать</button>' +
                '</div>';

        if (!me.welcome && !me.tg) {
            html += '<small style="color:#163B6B;background:#EAF1F9;border:1.5px dashed #B9CDE4;border-radius:12px;padding:8px 12px;display:block;margin-top:8px">🎁 <b>+1 штамп</b> за привязку в <a href="https://t.me/and_coffee_bot" style="color:#1F4E8C;font-weight:800">Telegram</a>: откройте бота и нажмите «Поделиться номером»</small>';
        }

        n.hidden = false;
        n.innerHTML = html;

        const ab = $("#actBtn");
        if (ab) {
            ab.onclick = async () => {
                try {
                    const codeVal = $("#actCode").value.trim();
                    const r = await api("/auth/activate-guest", {
                        method: "POST",
                        body: { code: codeVal },
                    });
                    me = r.customer;
                    toast("Профиль активирован! А +1 штамп ждёт в Telegram 🎁", "");
                    renderAll();
                } catch (e) {
                    toast(e.message, "⚠️");
                }
            };
        }
    }

    async function loadMyOrders() {
        var host = document.getElementById('myOrders');
        if (!host || !me) return;
        if (typeof brand !== 'undefined' && brand !== 'delivery') {
            host.innerHTML = '';
            return;
        }
        try {
            var r = await api('/orders/mine');
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
                return;
            }
            var s = ST[o.status] || ['•', 'mo-new', o.status];
            var d = new Date(o.created).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
            var items = (o.items || []).slice(0, 3).map(function (i) { return i.qty + '× ' + i.name; }).join(', ') + ((o.items || []).length > 3 ? '…' : '');

            var timeInfo = o.is_preorder
                ? ' · <b style="color:#B26A05">⏰ Предзаказ: ' + esc(o.slot) + '</b>'
                : (o.eta ? ' · ⏰ ' + esc(o.eta) : '');

            host.innerHTML = '<div class="myOrderCard"><div class="moTop"><span>Заказ #' + o.no + ' <span class="moDate">· ' + d + '</span></span><span class="moSt ' + s[1] + '">' + s[0] + ' ' + s[2] + '</span></div>' +
                '<div class="moSum">' + fmt(o.total) + timeInfo + '</div>' +
                (items ? '<div class="moItems">' + esc(items) + '</div>' : '') +
                ((o.gifts && o.gifts.length) ? '<div class="moGifts">🎁 ' + o.gifts.map(function (g) { return esc(g.name) + ' ×' + g.qty; }).join(', ') + '</div>' : '') + '</div>';
        } catch (e) { }
    }

    async function renderOrdersModal() {
        var list = document.getElementById('omList');
        if (!list || !me) return;
        list.innerHTML = '<div class="hmini">Загрузка…</div>';
        document.getElementById('ordersModal').classList.add('show');
        if (typeof window.syncOverlay === 'function') window.syncOverlay();
        try {
            var r = await api('/orders/mine');
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
                var timeInfo = o.is_preorder
                    ? ' · <b style="color:#B26A05">⏰ Предзаказ: ' + esc(o.slot) + '</b>'
                    : (o.eta ? ' · ⏰ ' + esc(o.eta) : '');

                return '<div class="myOrderCard" style="margin-bottom:8px"><div class="moTop"><span>Заказ #' + o.no + ' <span class="moDate">· ' + d + '</span></span><span class="moSt">' + (ST[o.status] || o.status) + '</span></div>' +
                    '<div class="moSum">' + fmt(o.total) + timeInfo + '</div>' +
                    '<div class="moItems">' + esc(o.items.map(function (i) { return i.qty + '× ' + i.name; }).join(', ')) + '</div>' +
                    ((o.gifts && o.gifts.length) ? '<div class="moGifts">🎁 ' + o.gifts.map(function (g) { return esc(g.name) + ' ×' + g.qty; }).join(', ') + '</div>' : '') + '</div>';
            }).join('') || '<div class="hmini">Заказов пока нет 🍕</div>';
        } catch (e) {
            list.innerHTML = '<div class="hmini">Не загрузилось</div>';
        }
    }

    Object.assign(window, { renderBonus, renderProfile, renderVerifyNote, loadMyOrders, renderOrdersModal });
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
    if (!pb || document.getElementById('myOrdersBtn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'myOrdersBtn';
    b.className = 'demoBtn';
    b.textContent = '📦 Мои заказы';
    var mo = document.getElementById('myOrders');
    if (mo) pb.insertBefore(b, mo);
    else pb.appendChild(b);
    b.onclick = window.renderOrdersModal;
})();

(function patchQR() {
    if (typeof window.renderProfile !== 'function') return;
    const _rp = window.renderProfile;
    window.renderProfile = function () {
        const r = _rp.apply(this, arguments);
        setTimeout(() => {
            try {
                if (!me || !me.qr) return;
                const pBox = document.getElementById('profileBox');
                if (!pBox) return;
                const target = pBox.querySelector('.qrbox small');
                if (target && !target.parentNode.querySelector('.qrCodeText')) {
                    const d = document.createElement('div');
                    d.className = 'qrCodeText';
                    d.style.cssText = 'text-align:center;font-weight:800;letter-spacing:.14em;margin:6px 0 2px;color:inherit;font-size:18px';
                    d.textContent = me.qr;
                    target.parentNode.insertBefore(d, target.nextSibling);
                }
            } catch (e) { }
        }, 50);
        return r;
    };
})();

document.addEventListener('click', function (e) {
  var b = (e.target && e.target.closest) ? e.target.closest('[data-auth]') : null;
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof openAuth === 'function') openAuth();
}, true);