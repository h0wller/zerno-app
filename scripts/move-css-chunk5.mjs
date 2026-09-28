/* scripts/fix-complete-green.mjs — Ф5.45:
   1. Восстановление [hidden] { display: none !important; } (снимает оверлей guestCard).
   2. Восстановление var _rpRunning = false; в profile.js (ликвидирует падение boot/renderProfile).
   3. Чистая разметка и логика бейджа бонусов: виден гостям (🫘 0/10) и профилю (🫘 X/10 + 🎁 N).
   4. Выравнивание рейла: на 1-м кадре строго по верху карточки, при скролле — фиксация по центру.
   5. Устранение ReferenceError alignRailWithCard в scrolltop.js.
   6. Инкремент STATIC_CACHE в sw.js.
*/
import fs from 'node:fs';

// ── 1. Восстановление public/app/ui/theme-v2.css ──
const TH_PATH = 'public/app/ui/theme-v2.css';
let th = fs.readFileSync(TH_PATH, 'utf8');

// Гарантируем системный [hidden] с !important
th = th.replace(/\[hidden\]\s*\{[^}]*\}/g, '[hidden] {\n  display: none !important;\n}');

// Зачищаем старые правила рейла с top: 50% и 100dvh
th = th.replace(/top:\s*50%;\s*transform:\s*translateY\(-50\%\);/g, 'top: calc(50dvh - 160px); transform: none;');
th = th.replace(/@media \(max-width: 1180px\) and \(min-height: 481px\) \{[\s\S]*?margin: auto 0;\s*\}\s*\}/g, '');
th = th.replace(/\/\* ── Ф5\.(41|42|43|44)[\s\S]*$/g, '');

// Добавляем финальную геометрию рейла и бейджа бонусов (0 !important)
const finalThemeCss = `/* ── Ф5.45: Финальная геометрия рейла и бейджа бонусов ── */
@media (max-width: 1180px) {
  .wrap .rail,
  .wrap #deliveryRail {
    position: sticky;
    top: calc(50dvh - 160px);
    margin-top: 140px;
    align-self: start;
    height: auto;
    max-height: calc(100dvh - 20px);
    transform: none;
    transition: none;
  }
}

@media (max-width: 1180px) and (max-height: 480px) {
  .wrap .rail,
  .wrap #deliveryRail {
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    margin-top: 0;
    max-height: calc(100dvh - 16px);
  }
}

@media (max-width: 820px) {
  /* Компактный бейдж бонусов: виден гостям (🫘 0/10) и профилю (🫘 X/10 + 🎁 N) */
  #mbonusBtn {
    display: flex;
    position: fixed;
    left: 8px;
    right: auto;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    width: 60px;
    max-width: 60px;
    padding: 6px 4px;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    border-radius: 16px;
    background: #101418;
    box-shadow: 0 10px 24px -6px rgba(16, 20, 24, 0.45);
    z-index: 94;
    cursor: pointer;
    transition: opacity 0.25s, transform 0.25s;
  }

  #mbonusBtn.near-footer {
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px);
  }

  #mbonusBtn::before {
    content: none;
  }

  #mbonusBtn .mb-stamps {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    color: #ffffff;
    white-space: nowrap;
  }

  #mbonusBtn .mb-bean {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff;
    color: #7B5233;
    flex-shrink: 0;
  }

  #mbonusBtn .mb-bean svg {
    width: 13px;
    height: 13px;
    display: block;
  }

  #mbonusBtn .mb-free {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 8px;
    background: linear-gradient(120deg, #f3e3ce, #e4c9a5);
    color: #4a3100;
  }

  /* Поиск на 100% ширины */
  .mh-top.mh-top .mh-right,
  #menuView .menu-head .mh-top .mh-right,
  #deliveryView .menu-head .mh-top .mh-right {
    width: 100%;
    max-width: 100%;
    margin-left: 0;
    flex: 1 1 100%;
  }

  #menuView .mh-top.mh-top .search,
  #deliveryView .mh-top.mh-top .search,
  #menuView .menu-head .mh-top .search,
  #deliveryView .menu-head .mh-top .search,
  .mh-top.mh-top .search {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
    min-width: 0;
    margin: 8px 0 0 0;
    box-sizing: border-box;
  }
}
`;

th = th.trimEnd() + '\n\n' + finalThemeCss + '\n';
fs.writeFileSync(TH_PATH, th, 'utf8');
console.log('✅ theme-v2.css: [hidden] и мобильная геометрия восстановлены');

// ── 2. Исправление public/app/profile.js ──
const PROF_PATH = 'public/app/profile.js';
let prof = fs.readFileSync(PROF_PATH, 'utf8');

// Полная чистая сборка функций бонусов и профиля с объявлением _rpRunning
const cleanProfileChunk = `function updateMbonusBadge() {
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
            _onMeResolved(function () { try { renderBonus(); } catch (e) {} });
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
                    ? \`<div class="stamp f \${i === me.stamps - 1 ? "last" : ""}">\${stampIcon(i)}</div>\`
                    : i === me.stamps && !me.free
                        ? \`<div class="stamp n"></div>\`
                        : \`<div class="stamp e"></div>\`;
        var sg = document.getElementById("stampGrid");
        if (sg) sg.innerHTML = h;

        var bp = document.getElementById("bonusProg");
        if (bp) {
            bp.innerHTML =
                me.free > 0
                    ? \`У вас <b>\${me.free} бесплатный(х) кофе</b> 🎉\`
                    : \`До бесплатного кофе: <b>\${10 - me.stamps} \${cupWord(10 - me.stamps)}</b> из 10\`;
        }

        var fsEl = document.getElementById("freeSlot");
        if (fsEl) {
            fsEl.innerHTML =
                me.free > 0
                    ? \`<div class="freeCard"><span class="fe">🎁</span>
<div><b>Кофе за наш счёт ×\${me.free}</b><small>Покажите этот экран кассиру</small></div></div>\`
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
                            \`<div class="hmini"><b>\${fmtTs(h.ts)}</b> · \${esc(h.a)} <i>— \${esc(h.by)}</i></div>\`,
                    )
                    .join("") || '<div class="hmini">История пока пуста</div>';

            if (typeof window.syncBrandViews === "function") window.syncBrandViews();
        } finally {
            _rpRunning = false;
        }
    }`;

prof = prof.replace(
  /(function updateMbonusBadge[\s\S]*?|function renderBonus\(\)[\s\S]*?|var _rpRunning[\s\S]*?)(?=\/\* ── блок верификации)/,
  cleanProfileChunk + '\n\n    '
);
fs.writeFileSync(PROF_PATH, prof, 'utf8');
console.log('✅ profile.js: объявлен _rpRunning, ошибки textContent устранены');

// ── 3. Чистая сборка public/app/ui/scrolltop.js ──
const SC_PATH = 'public/app/ui/scrolltop.js';
const cleanScrolltop = `/* public/app/ui/scrolltop.js — кнопка «вверх» и синхронизация положения рейла */
function alignRailWithCard() {
  if (window.innerWidth > 1180) {
    var rAll = document.querySelectorAll('.wrap .rail, .wrap #deliveryRail');
    rAll.forEach(function (r) { r.style.marginTop = ''; });
    return;
  }
  var rail = document.querySelector('.wrap .rail:not([style*="display: none"]), .wrap #deliveryRail:not([style*="display: none"])');
  if (!rail || !rail.parentElement) return;
  var card = document.querySelector('#menuView:not([hidden]) .card:not(.skeleton-card), #deliveryView.active .card:not(.skeleton-card), #grid .card:not(.skeleton-card), #deliveryGrid .card:not(.skeleton-card)');
  if (!card) return;

  var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  var cardTop = card.getBoundingClientRect().top + scrollY;
  var parentTop = rail.parentElement.getBoundingClientRect().top + scrollY;
  var diff = Math.max(0, Math.round(cardTop - parentTop));
  rail.style.marginTop = diff + 'px';
}
window.alignRailWithCard = alignRailWithCard;

(function () {
  'use strict';
  var css = document.createElement('style');
  css.textContent =
    '#scrollTopBtn{position:fixed;right:20px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:96;width:48px;height:48px;border-radius:50%;' +
    'border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:20px;line-height:1;' +
    'display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -8px rgba(16,20,24,.4);' +
    'opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
    '#scrollTopBtn.show{opacity:1;pointer-events:auto;transform:none}' +
    '#scrollTopBtn.low{bottom:calc(20px + env(safe-area-inset-bottom,0px))}' +
    '#scrollTopBtn:active{transform:scale(.94)}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.id = 'scrollTopBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Наверх');
  btn.textContent = '↑';
  document.body.appendChild(btn);

  function update() {
    var chat = document.getElementById('chatPanel');
    var chatOpen = !!(chat && chat.classList.contains('open'));
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    btn.classList.toggle('show', !chatOpen && y > 400);
    var fab = document.getElementById('chatFab');
    btn.classList.toggle('low', !fab || getComputedStyle(fab).display === 'none');
  }

  var tick = false;
  function onScroll() {
    if (tick) return;
    tick = true;
    requestAnimationFrame(function () {
      tick = false;
      update();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    onScroll();
    alignRailWithCard();
  });
  if (typeof MutationObserver !== 'undefined') {
    var cp = document.getElementById('chatPanel');
    if (cp) new MutationObserver(onScroll).observe(cp, { attributes: true, attributeFilter: ['class'] });
  }
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  update();
  setTimeout(alignRailWithCard, 40);
  setTimeout(alignRailWithCard, 250);
})();
`;
fs.writeFileSync(SC_PATH, cleanScrolltop, 'utf8');
console.log('✅ scrolltop.js: alignRailWithCard объявлена глобально до update()');

// ── 4. Канонический шаблон в public/index.html ──
const HTML_PATH = 'public/index.html';
let html = fs.readFileSync(HTML_PATH, 'utf8');
html = html.replace(/<button class="mbonus" id="mbonusBtn"[\s\S]*?<\/button>/g, '');
const canonicalMbonusBtn = `<button class="mbonus" id="mbonusBtn" type="button" aria-label="Бонусы">
      <span class="mb-stamps"><span class="mb-bean"></span><span id="mbonusSt">0/10</span></span>
      <span class="mb-free" id="mbonusFree" hidden>🎁 0</span>
    </button>`;

html = html.replace(
  '<div class="modeSeg" id="modeSeg" hidden></div>',
  '<div class="modeSeg" id="modeSeg" hidden></div>\n      ' + canonicalMbonusBtn
);
fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log('✅ index.html: разметка #mbonusBtn обновлена');

// ── 5. Инкремент STATIC_CACHE в public/sw.js ──
const SW_PATH = 'public/sw.js';
let sw = fs.readFileSync(SW_PATH, 'utf8');
sw = sw.replace(/zerno-static-v(\d+)/, (m, n) => 'zerno-static-v' + (parseInt(n, 10) + 1));
fs.writeFileSync(SW_PATH, sw, 'utf8');
console.log('✅ sw.js: STATIC_CACHE инкрементирован');