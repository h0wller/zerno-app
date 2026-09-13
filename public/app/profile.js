/* public/app/profile.js — F2.2: профиль гостя, бонусы, верификация */

/* ── state: хелперы штампов ── */
var cupWord = n => n === 1 ? 'чашка' : (n > 0 && n < 5 ? 'чашки' : 'чашек');
var BEAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-24 12 12)"><ellipse cx="12" cy="12" rx="7.6" ry="9.6" fill="currentColor"/></g></svg>';
var stampIcon = i => i === 9 ? '☕' : BEAN;

(function () {
  'use strict';

  /* ── бонусы ── */
  function renderBonus() {
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
    const b = $("#burnFree");
    if (b)
      b.onclick = async () => {
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
  }

  /* ── профиль ── */
  function renderProfile() {
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
    loadMyOrders();
  }

  /* ── блок верификации под кнопкой PIN ── */
  function renderVerifyNote() {
    let n = $("#verifyNote");
    if (!n && $("#setPinBtn")) {
      n = document.createElement("div");
      n.id = "verifyNote";
      $("#setPinBtn").parentNode.insertBefore(n, $("#setPinBtn"));
    }
    if (!n) return;
    if (!me) {
      n.hidden = true;
      return;
    }
    let html = "";
    if (!me.verified)
      html +=
        '<small style="color:#8A4B2A;background:#FFF6F0;border:1.5px dashed #E4B49A;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">🧾 Кассир назовёт 4 цифры кода активации — введите их:</small><div style="display:flex;gap:8px"><input id="actCode" inputmode="numeric" maxlength="4" placeholder="Код" style="flex:1"><button class="btn fire" id="actBtn">Активировать</button></div>';
    if (!me.welcome && !me.tg)
      html +=
        '<small style="color:#163B6B;background:#EAF1F9;border:1.5px dashed #B9CDE4;border-radius:12px;padding:8px 12px;display:block;margin-top:8px">🎁 <b>+1 штамп</b> за привязку в <a href="https://t.me/and_coffee_bot" style="color:#1F4E8C;font-weight:800">Telegram</a>: откройте бота и нажмите «Поделиться номером»</small>';
    n.hidden = !html;
    n.innerHTML = html;
    const ab = $("#actBtn");
    if (ab)
      ab.onclick = async () => {
        try {
          const r = await api("/auth/activate-guest", {
            method: "POST",
            body: { code: $("#actCode").value.trim() },
          });
          me = r.customer;
          toast("Профиль активирован! А +1 штамп ждёт в Telegram 🎁", "");
          renderAll();
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };
  }

  /* ── история заказов в профиле ── */
  async function loadMyOrders() {
    const host = $("#myOrders");
    if (!host || !me) return;
    try {
      const r = await api("/orders/mine");
      host.innerHTML = (r.orders || []).length
        ? '<h4 style="margin:14px 2px 9px">Мои заказы</h4>' +
          r.orders
            .slice(0, 5)
            .map(
              (o) =>
                `<div class="hmini"><b>#${o.no}</b> · ${new Date(o.created).toLocaleDateString("ru-RU")} · ${fmt(o.total)} · ${orderLabel(o.status)}</div>`,
            )
            .join("")
        : "";
    } catch (e) {
      host.innerHTML = "";
    }
  }

  /* ── shim в window — контракт F1.3 ── */
  Object.assign(window, { renderBonus, renderProfile, renderVerifyNote, loadMyOrders });
})();