/* public/app/core/dash.js — дашборд владельца: кофейная статистика и вкладки брендов. */
let dashTab = "coffee";
let coffeeLoadedAt = 0;
let coffeeLoadedMonth = "";
let coffeeRequestId = 0;
const COFFEE_REFRESH_MS = 30000;
const coffeeMonthInput = $("#dashCoffeeMonth");

function currentCoffeeMonth() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kaliningrad" })
    .format(new Date())
    .slice(0, 7);
}

function getSelectedCoffeeMonth() {
  if (!coffeeMonthInput) return currentCoffeeMonth();
  const current = currentCoffeeMonth();
  coffeeMonthInput.max = current;
  if (!coffeeMonthInput.value) coffeeMonthInput.value = current;
  return coffeeMonthInput.value;
}

function formatCoffeeMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
}

function renderCoffeeStats(s, report) {
  const items = Array.isArray(report.items) ? report.items : [];
  const topItem = items[0];
  const monthLabel = formatCoffeeMonth(report.month);

  $("#dashTop").innerHTML = `
    <div class="bt btMain btSpan2">
      <span class="btLabel">Подарочных напитков списано</span>
      <b class="btVal">${Number(report.total) || 0}</b>
      <span class="btOwn">${esc(monthLabel)}</span>
    </div>
    <div class="bt btSpan2">
      <span class="btLabel">Штампов начислено</span>
      <b class="btVal">${Number(report.stamps) || 0}</b>
      <span class="btOwn">за выбранный месяц</span>
    </div>
    <div class="bt">
      <span class="btLabel">Видов списания</span>
      <b class="btVal">${items.length}</b>
      <span class="btOwn">по бесплатным напиткам</span>
    </div>
    <div class="bt">
      <span class="btLabel">Чаще списывали</span>
      <b class="btProductName">${topItem ? esc(topItem.name) : "—"}</b>
      <span class="btOwn">${topItem ? `×${topItem.qty} за месяц` : "нет списаний"}</span>
    </div>`;

  const days = Array.isArray(report.days) ? report.days : [];
  const maxRedemptions = Math.max(1, ...days.map((day) => Number(day.redemptions) || 0));
  const chartColumns = days.map((day) => {
    const redemptions = Number(day.redemptions) || 0;
    const height = Math.round(6 + (96 * redemptions) / maxRedemptions);
    const detail = (day.items || [])
      .map((item) => `${item.name} ×${item.qty}`)
      .join(", ");
    const tip = `${day.label}: ${redemptions} списаний${detail ? ` · ${detail}` : ""} · штампов: ${day.stamps || 0}`;
    return `
      <div class="btBarCol">
        <div class="btBar ${redemptions ? "hasData" : ""}" style="height:${height}px" title="${esc(tip)}"></div>
        <span class="btBarLbl">${day.label.slice(0, 2)}</span>
      </div>`;
  }).join("");

  $("#dashChart").innerHTML = `<div class="coffeeChartInner">${chartColumns}</div>`;

  const byDrinkHtml = items.length
    ? items.map((item) => `
        <div class="btTopRow">
          <span>${esc(item.name)}</span>
          <b>×${Number(item.qty) || 0}</b>
        </div>`).join("")
    : '<div class="btOwn">За выбранный месяц бесплатные напитки не списывали</div>';

  const dailyRows = days.map((day) => {
    const details = (day.items || []).length
      ? day.items.map((item) => `${esc(item.name)} ×${Number(item.qty) || 0}`).join(" · ")
      : "Списаний не было";
    const hasActivity = (day.redemptions || 0) > 0 || (day.stamps || 0) > 0;
    return `
      <div class="coffeeDayRow ${hasActivity ? "hasActivity" : ""}">
        <time class="coffeeDayDate" datetime="${day.date}">${day.label}</time>
        <div class="coffeeDayContent">
          <span class="coffeeDayItems">${details}</span>
          <small>Подарков: ${Number(day.redemptions) || 0} · штампов: ${Number(day.stamps) || 0}</small>
        </div>
      </div>`;
  }).join("");

  $("#dashMore").innerHTML = `
    <section class="bt btSpan2">
      <span class="btLabel">Списано по видам напитков</span>
      <div class="btTopList">${byDrinkHtml}</div>
    </section>
    <section class="bt btSpan2">
      <span class="btLabel">Лояльность</span>
      <div class="btTopList">
        <div class="btTopRow"><span>Гостей в базе</span><b>${Number(s.total) || 0}</b></div>
        <div class="btTopRow"><span>Новых за 7 дней</span><b>${Number(s.newWeek) || 0}</b></div>
        <div class="btTopRow"><span>С 2+ чашками</span><b>${Number(s.returning) || 0}</b></div>
      </div>
      <span class="btOwn">Это показатели базы, не продажи за выбранный месяц</span>
    </section>
    <section class="bt btFull">
      <span class="btLabel">Операции по дням · ${esc(monthLabel)}</span>
      <div class="coffeeDayList">${dailyRows}</div>
    </section>
    <p class="coffeeDataNote btFull">
      Подарочные напитки считаются по выбранному виду при списании. Штампы показывают только начисления в программе лояльности: они не содержат вид купленного напитка и не включают продажи без штампа. Расход зерна и молока по текущим данным не рассчитывается.
    </p>`;
}

async function loadCoffeeStats(force = false) {
  const month = getSelectedCoffeeMonth();
  if (!force && month === coffeeLoadedMonth && Date.now() - coffeeLoadedAt < COFFEE_REFRESH_MS) return;

  const requestId = ++coffeeRequestId;
  try {
    const [stats, report] = await Promise.all([
      api("/stats"),
      api("/stats/redeems?month=" + encodeURIComponent(month))
    ]);
    if (requestId !== coffeeRequestId) return;
    renderCoffeeStats(stats, report);
    coffeeLoadedMonth = month;
    coffeeLoadedAt = Date.now();
    const status = $("#dashCoffeeStatus");
    if (status) status.textContent = `Отчёт за ${formatCoffeeMonth(month)} · часовой пояс Янтарного`;
  } catch (error) {
    if (requestId !== coffeeRequestId) return;
    const status = $("#dashCoffeeStatus");
    if (status) status.textContent = "Не удалось загрузить месячную статистику. Обновите отчёт.";
    toast(error.message, "⚠️");
  }
}

function setDashTab(tab) {
  dashTab = tab === "delivery" ? "delivery" : "coffee";
  document.querySelectorAll("#dashTabs [data-dtab]").forEach((button) => {
    const active = button.dataset.dtab === dashTab;
    button.classList.toggle("on", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
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
  tabsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dtab]");
    if (button) setDashTab(button.dataset.dtab);
  });
}

if (coffeeMonthInput) {
  coffeeMonthInput.addEventListener("change", () => {
    loadCoffeeStats(true);
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
    if (
      $("#dashModal").classList.contains("show") &&
      dashTab === "coffee" &&
      Date.now() - coffeeLoadedAt > COFFEE_REFRESH_MS
    ) {
      loadCoffeeStats(true);
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
