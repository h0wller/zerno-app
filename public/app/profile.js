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
        try { hasToken = (typeof USER_TOKEN !== 'undefined' && !!USER_TOKEN); } catch (_) { }
        if (!hasToken) {
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (!k || !/token|auth|jwt/i.test(k)) continue;
                    var v = localStorage.getItem(k);
                    if (v && v.length > 8) { hasToken = true; break; }
                }
            } catch (_) { }
        }
        var timeout = hasToken ? 3000 : 300;
        var tick = function () {
            if (_meResolved) return;
            var loaded = false;
            try { loaded = (typeof me !== 'undefined') && me !== null; } catch (_) { }
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

    function updateMbonusBadge() {
        var mbBtn = document.getElementById("mbonusBtn");
        if (!mbBtn) return;
        var stamps = (window.me && typeof window.me.stamps === 'number') ? window.me.stamps : 0;
        var free = (window.me && typeof window.me.free === 'number') ? window.me.free : 0;
        mbBtn.dataset.st = stamps + "/10";

        var stNum = document.getElementById("mbonusSt");
        if (stNum) stNum.textContent = stamps + "/10";

        var beanEl = mbBtn.querySelector('.mb-bean');
        if (beanEl && !beanEl.querySelector('svg')) {
            beanEl.innerHTML = BEAN;
        }

        var mbf = document.getElementById("mbonusFree");
        if (mbf) {
            mbf.hidden = free < 1;
            mbf.textContent = '🎁 ' + free;
            mbf.title = 'Бесплатных кофе: ' + free;
        }
    }
    window.updateMbonusBadge = updateMbonusBadge;

    /* ── бонусы ── */
    function renderBonus() {
        updateMbonusBadge();
        if (!_meResolved) {
            var noUserEl = document.getElementById('bonusNoUser');
            var boxEl = document.getElementById('bonusBox');
            if (noUserEl) noUserEl.hidden = true;
            if (boxEl) boxEl.hidden = true;
            _onMeResolved(function () { try { renderBonus(); } catch (e) { } });
            return;
        }
        var bnu = document.getElementById("bonusNoUser");
        if (bnu) bnu.hidden = !!me;
        var bbx = document.getElementById("bonusBox");
        if (bbx) bbx.hidden = !me;

        if (!me) return;

        let h = "";
        for (let i = 0; i < 10; i++)
            h +=
                i < me.stamps
                    ? `<div class="stamp f ${i === me.stamps - 1 ? "last" : ""}">${stampIcon(i)}</div>`
                    : i === me.stamps && !me.free
                        ? `<div class="stamp n"></div>`
                        : `<div class="stamp e"></div>`;
        var sg = document.getElementById("stampGrid");
        if (sg) sg.innerHTML = h;

        var bp = document.getElementById("bonusProg");
        if (bp) {
            bp.innerHTML =
                me.free > 0
                    ? `У вас <b>${me.free} бесплатный(х) кофе</b> 🎉`
                    : `До бесплатного кофе: <b>${10 - me.stamps} ${cupWord(10 - me.stamps)}</b> из 10`;
        }

        var fsEl = document.getElementById("freeSlot");
        if (fsEl) {
            fsEl.innerHTML =
                me.free > 0
                    ? `<div class="freeCard"><span class="fe">🎁</span>
<div><b>Кофе за наш счёт ×${me.free}</b><small>Покажите этот экран кассиру</small></div></div>`
                    : "";
        }

        const burnBtn = document.getElementById("burnFree");
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

        updateMbonusBadge();

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
    var nameEditing = false;
    var historyExpanded = false;

    function setNameEditing(editing) {
        nameEditing = editing;
        var input = document.getElementById('nameInput');
        var edit = document.getElementById('nameEditBtn');
        var actions = document.getElementById('nameEditActions');
        var save = document.getElementById('nameSaveBtn');
        if (input) {
            input.readOnly = !editing;
            input.setAttribute('aria-readonly', String(!editing));
        }
        if (edit) edit.hidden = editing;
        if (actions) actions.hidden = !editing;
        if (save) save.disabled = false;
    }

    async function saveProfileName() {
        var input = document.getElementById('nameInput');
        var save = document.getElementById('nameSaveBtn');
        if (!input || !me || !nameEditing) return;
        var name = input.value.trim() || me.name || 'Гость';
        if (name === me.name) return setNameEditing(false);
        if (save) save.disabled = true;
        try {
            var result = await api('/me', { method: 'PUT', body: { name: name } });
            me = result.customer;
            setNameEditing(false);
            renderProfile();
            toast('Имя профиля обновлено', '✅');
        } catch (error) {
            toast(error.message, '⚠️');
            if (save) save.disabled = false;
        }
    }

    function renderHistory() {
        var list = document.getElementById('histList');
        var count = document.getElementById('historyCount');
        var toggle = document.getElementById('historyToggleBtn');
        if (!list || !me) return;
        var history = Array.isArray(me.history) ? me.history : [];
        var visible = historyExpanded ? history : history.slice(0, 3);
        list.innerHTML = visible.map(function (item) {
            return '<div class="hmini"><b>' + esc(fmtTs(item.ts)) + '</b> · ' + esc(item.a) + ' <i>— ' + esc(item.by) + '</i></div>';
        }).join('') || '<div class="hmini">История пока пуста</div>';
        if (count) count.textContent = history.length ? String(history.length) : '';
        if (toggle) {
            toggle.hidden = history.length <= 3;
            toggle.textContent = historyExpanded ? 'Свернуть историю' : 'Показать всю историю';
            toggle.setAttribute('aria-expanded', String(historyExpanded));
        }
    }

    (function bindProfileControls() {
        var input = document.getElementById('nameInput');
        var edit = document.getElementById('nameEditBtn');
        var save = document.getElementById('nameSaveBtn');
        var cancel = document.getElementById('nameCancelBtn');
        var historyToggle = document.getElementById('historyToggleBtn');
        if (edit) edit.addEventListener('click', function () {
            if (!me || !input) return;
            input.value = me.name || '';
            setNameEditing(true);
            input.focus();
            input.select();
        });
        if (save) save.addEventListener('click', saveProfileName);
        if (cancel) cancel.addEventListener('click', function () {
            if (input && me) input.value = me.name || '';
            setNameEditing(false);
            if (edit) edit.focus();
        });
        if (input) input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && nameEditing) {
                event.preventDefault();
                saveProfileName();
            } else if (event.key === 'Escape' && nameEditing) {
                event.preventDefault();
                if (cancel) cancel.click();
            }
        });
        if (historyToggle) historyToggle.addEventListener('click', function () {
            historyExpanded = !historyExpanded;
            renderHistory();
        });
    })();

    function renderProfile() {
        if (_rpRunning) return;
        _rpRunning = true;
        try {
            if (!_meResolved) {
                var pnu = document.getElementById('profileNoUser');
                var pbx = document.getElementById('profileBox');
                if (pnu) pnu.hidden = true;
                if (pbx) pbx.hidden = true;
                _onMeResolved(function () { try { renderProfile(); } catch (e) { } });
                return;
            }
            $("#profileNoUser").hidden = !!me;
            $("#profileBox").hidden = !me;
            if (!me) {
                $("#avInit").textContent = "?";
                $("#profileTopBtn").textContent = "?";
                if ($("#nameInput")) $("#nameInput").value = "";
                setNameEditing(false);
                historyExpanded = false;
                return;
            }
            $("#avInit").textContent = (me.name[0] || "Г").toUpperCase();
            $("#profileTopBtn").textContent = (me.name[0] || "Г").toUpperCase();
            if (!nameEditing) $("#nameInput").value = me.name || "";
            $("#phoneLbl").textContent = me.phone + " · вход по номеру";
            // Кнопки админа (чаты, дашборд, промокоды) показывает views.js по режиму, а не по роли.
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
            $("#stCups").textContent = me.cups;
            $("#stStamps").textContent = me.stamps + "/10";
            $("#stFree").textContent = me.free;
            renderHistory();

            if (typeof window.syncBrandViews === "function") window.syncBrandViews();
        } finally {
            _rpRunning = false;
        }
    }

    Object.assign(window, { renderBonus, renderProfile });

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
/* ── Ф5.8f: ESM-шимы: catalog.js/profile-brand.js/boot.js/live.js ── */
window.renderBonus = renderBonus;

/* ── Ф5.25: ESM-шимы для кассира (точки штампов, склонения чашек) ── */
window.stampIcon = stampIcon; /* Ф5.25: dotsHTML в cashier.js */
window.cupWord = cupWord; /* Ф5.25: тексты списаний/подарков */

