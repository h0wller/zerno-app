/* public/app/core/dash.js — Ф5.7: кластер "dash" из legacy-core.js. Top-level = global. */
let dashTab = "coffee";
let coffeeLoadedAt = 0;
const COFFEE_REFRESH_MS = 30000;

async function loadCoffeeStats() {
  coffeeLoadedAt = Date.now();
  try {
    const [s, rd] = await Promise.all([api("/stats"), api("/stats/redeems").catch(() => null)]);
    const staffNote = s.staffCount ? `<small class="statSub">из них сотрудники: ${s.staffCount}</small>` : "";
    $("#dashTop").innerHTML = `
     <div class="stat"><b>${s.total}</b><span>всего гостей</span>${staffNote}</div>
     <div class="stat"><b>${s.newWeek}</b><span>новых за 7 дн</span></div>
     <div class="stat"><b>${s.returning}</b><span>с 2+ чашками</span></div>`;
    const max = Math.max(1, ...s.days.map((d) => d.c));
    $("#dashChart").innerHTML = s.days
      .map(
        (d) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0">
      <div style="width:100%;background:${d.c ? "var(--flame)" : "#E7ECF0"};border-radius:6px;height:${Math.round(6 + (104 * d.c) / max)}px" title="${d.label}: ${d.c}"></div>
      <small style="font-size:9px;color:#8B98A5">${d.label}</small></div>`
      )
      .join("");
    $("#dashMore").innerHTML = `
     <div class="hmini">Штампы: сегодня <b>${s.stampsToday}</b> · за 7 дн <b>${s.stampsWeek}</b> · за 30 дн <b>${s.stampsMonth}</b></div>
     <div class="hmini">Бесплатных кофе списано за 30 дн: <b>${s.redeemed}</b> · новых гостей за 30 дн: <b>${s.newMonth}</b></div>
     <div class="hmini">Средняя чашек на гостя: <b>${s.avgCups}</b> · активаций промокодов: <b>${s.promoUses}</b></div>`;
    if (rd) {
      const items = Object.entries(rd.byItem || {}).sort((a, b) => b[1] - a[1]);
      $("#dashMore").innerHTML += `
     <div class="hmini" style="margin-top:8px">🎁 Списано бесплатных кофе за 30 дн: <b>${rd.total}</b>${
        items.length ? " · " + items.map((e) => esc(e[0]) + " ×" + e[1]).join(", ") : ""
      }</div>`;
    }
  } catch (e) {
    toast(e.message, "⚠️");
  }
}

function setDashTab(tab) {
  dashTab = tab === "delivery" ? "delivery" : "coffee";
  document.querySelectorAll("#dashTabs [data-dtab]").forEach((btn) => {
    const on = btn.dataset.dtab === dashTab;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll("#dashModal [data-dpane]").forEach((pane) => {
    pane.hidden = pane.dataset.dpane !== dashTab;
  });
  if (dashTab === "coffee") {
    loadCoffeeStats();
  } else if (window.ztBus) {
    window.ztBus.emit("dash:tab", "delivery");
  }
}

const tabsEl = $("#dashTabs");
if (tabsEl) {
  tabsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dtab]");
    if (b) setDashTab(b.dataset.dtab);
  });
}

$("#dashToggle").onclick = async () => {
  $("#dashModal").classList.add("show");
  syncOverlay();
  window.loadSubs();
  const initialTab = typeof window.brand !== "undefined" && window.brand === "delivery" ? "delivery" : "coffee";
  setDashTab(initialTab);
};

if (window.ztBus) {
  window.ztBus.on("dash:refresh", () => {
    if ($("#dashModal").classList.contains("show") && dashTab === "coffee" && Date.now() - coffeeLoadedAt > COFFEE_REFRESH_MS) {
      loadCoffeeStats();
    }
  });
}

async function loadSubs() {
  try {
    const ps = await api("/push/subs");
    const m = {};
    ['subs', 'tg'].forEach((chKey) => {
      const channel = chKey === 'subs' ? 'web' : 'tg';
      (ps[chKey] || []).forEach((s) => {
        const k = (s.phone || '') + '|' + (s.name || '—');
        const g = (m[k] = m[k] || {
          name: s.name,
          phone: s.phone,
          web: 0,
          tg: 0,
          webTs: null,
          tgTs: null,
        });
        g[channel]++;
        const tsField = channel + 'Ts';
        if (!g[tsField]) g[tsField] = s.created;
      });
    });
    const rows = Object.values(m)
      .map((g) => {
        const tags = [
          g.web ? `🔔 пуш${g.web > 1 ? " ×" + g.web : ""}` : "",
          g.tg ? "🤖 TG" : "",
        ]
          .filter(Boolean)
          .join(" | ");
        const ttl = [
          g.webTs ? `пуш с ${new Date(g.webTs).toLocaleDateString("ru-RU")}` : "",
          g.tgTs ? `TG с ${new Date(g.tgTs).toLocaleDateString("ru-RU")}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return `<div class="hmini" title="${esc(ttl)}"><b>${esc(g.name || "—")}</b> · ${esc(g.phone || "")} · ${tags}</div>`;
      })
      .join("");
    $("#pushSubs").innerHTML = rows || '<div class="hmini">Пока никто не подписан</div>';
  } catch (e) {}
}

function closeDash() {
  $("#dashModal").classList.remove("show");
  syncOverlay();
}
$("#dashClose").onclick = closeDash;

window.loadSubs = loadSubs;
window.closeDash = closeDash;
