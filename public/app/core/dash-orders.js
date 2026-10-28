/* public/app/core/dash-orders.js — вкладка «Пятница» дашборда: заказы доставки. */
const STATUS_LABELS = {
  new: "Новые",
  accept: "Приняты",
  cook: "Готовятся",
  way: "В пути",
  done: "Выполнены"
};

let loadingOrdersStats = false;

function isDeliveryPaneActive() {
  const modal = $("#dashModal");
  const pane = document.querySelector('#dashModal [data-dpane="delivery"]');
  return !!(modal && modal.classList.contains("show") && pane && !pane.hidden);
}

function mergePeriod(p) {
  const g = (p && p.guest) || { orders: 0, revenue: 0, cancelled: 0, pickup: 0, delivery: 0, preorders: 0, byStatus: {}, top: [] };
  const s = (p && p.staff) || { orders: 0, revenue: 0, cancelled: 0, pickup: 0, delivery: 0, preorders: 0, byStatus: {}, top: [] };
  const orders = (g.orders || 0) + (s.orders || 0);
  const revenue = (g.revenue || 0) + (s.revenue || 0);
  const byStatus = {};
  for (const src of [g.byStatus || {}, s.byStatus || {}]) {
    for (const k of Object.keys(src)) byStatus[k] = (byStatus[k] || 0) + (src[k] || 0);
  }
  const topMap = {};
  for (const src of [g.top || [], s.top || []]) {
    for (const item of src) topMap[item.name] = (topMap[item.name] || 0) + (item.qty || 0);
  }
  const top = Object.entries(topMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return {
    orders,
    revenue,
    avg: orders ? Math.round(revenue / orders) : 0,
    cancelled: (g.cancelled || 0) + (s.cancelled || 0),
    pickup: (g.pickup || 0) + (s.pickup || 0),
    delivery: (g.delivery || 0) + (s.delivery || 0),
    preorders: (g.preorders || 0) + (s.preorders || 0),
    byStatus,
    top,
    ownOrders: s.orders || 0,
    ownRevenue: s.revenue || 0,
    ownCancelled: s.cancelled || 0
  };
}

function renderBento(data) {
  const host = $("#dashOrders");
  if (!host) return;
  const t = mergePeriod(data.today);
  const w = mergePeriod(data.week);
  const days = Array.isArray(data.days) ? data.days : [];
  const maxDay = Math.max(1, ...days.map((d) => (d.guest || 0) + (d.staff || 0)));

  const statusHtml = Object.entries(STATUS_LABELS)
    .map(([k, label]) => `<span class="btChip">${label}: <b>${w.byStatus[k] || 0}</b></span>`)
    .join("");

  const chartHtml = days
    .map((d) => {
      const total = (d.guest || 0) + (d.staff || 0);
      const h = Math.round(6 + (96 * total) / maxDay);
      const ownH = total > 0 && d.staff ? Math.round((h * d.staff) / total) : 0;
      const tip = `${d.label}: ${total} зак. (свои: ${d.staff || 0}) · ${fmt(d.revenue || 0)}`;
      return `<div class="btBarCol">
        <div class="btBar ${total ? "hasData" : ""}" style="height:${h}px" title="${esc(tip)}">
          ${ownH ? `<div class="btBarOwn" style="height:${ownH}px"></div>` : ""}
        </div>
        <span class="btBarLbl">${esc(d.label)}</span>
      </div>`;
    })
    .join("");

  const topHtml = w.top.length
    ? w.top
        .map((item) => `<div class="btTopRow"><span>${esc(item.name)}</span><b>×${item.qty}</b></div>`)
        .join("")
    : '<div class="btOwn">За 7 дней заказов пока нет</div>';

  const recentStaff = (data.week && data.week.staff && data.week.staff.recent) || [];
  const staffRecentHtml = recentStaff.length
    ? recentStaff
        .slice(0, 5)
        .map(
          (o) =>
            `<div class="btTopRow"><span>#${esc(o.no)} · ${esc(o.name || "Сотрудник")}</span><b>${fmt(o.total)} · ${esc(fmtTs(o.ts))}</b></div>`
        )
        .join("")
    : '<div class="btOwn">Заказов сотрудников за 7 дней нет</div>';

  host.innerHTML = `
    <div class="bentoGrid">
      <div class="bt btMain btSpan2">
        <span class="btLabel">Выручка сегодня</span>
        <b class="btVal">${fmt(t.revenue)}</b>
        <span class="btOwn">заказов: ${t.orders} · из них свои: ${t.ownOrders} (${fmt(t.ownRevenue)})</span>
      </div>
      <div class="bt btSpan2">
        <span class="btLabel">Выручка за 7 дней</span>
        <b class="btVal">${fmt(w.revenue)}</b>
        <span class="btOwn">заказов: ${w.orders} · из них свои: ${w.ownOrders} (${fmt(w.ownRevenue)})</span>
      </div>
      <div class="bt">
        <span class="btLabel">Средний чек (7 дн)</span>
        <b class="btVal">${fmt(w.avg)}</b>
        <span class="btOwn">гости: ${fmt((data.week && data.week.guest && data.week.guest.avg) || 0)}</span>
      </div>
      <div class="bt">
        <span class="btLabel">Доставка / Самовывоз</span>
        <b class="btVal">${w.delivery} / ${w.pickup}</b>
        <span class="btOwn">за 7 дней</span>
      </div>
      <div class="bt">
        <span class="btLabel">Предзаказы</span>
        <b class="btVal">${w.preorders}</b>
        <span class="btOwn">сегодня: ${t.preorders}</span>
      </div>
      <div class="bt">
        <span class="btLabel">Отмены (7 дн)</span>
        <b class="btVal">${w.cancelled}</b>
        <span class="btOwn">свои: ${w.ownCancelled}</span>
      </div>
      <div class="bt btFull">
        <span class="btLabel">Статусы за 7 дней</span>
        <div class="btStatusRow">${statusHtml}</div>
      </div>
      <div class="bt btFull">
        <span class="btLabel">Динамика заказов за 14 дней (светлая доля — свои)</span>
        <div class="btChart">${chartHtml}</div>
      </div>
      <div class="bt btSpan2">
        <span class="btLabel">Топ-5 позиций за 7 дней</span>
        <div class="btTopList">${topHtml}</div>
      </div>
      <div class="bt btSpan2">
        <span class="btLabel">🧑‍🍳 Последние заказы «своих»</span>
        <div class="btTopList">${staffRecentHtml}</div>
      </div>
    </div>`;
}

async function loadOrdersStats() {
  if (loadingOrdersStats) return;
  loadingOrdersStats = true;
  try {
    const data = await api("/stats/orders?days=14");
    renderBento(data);
  } catch (e) {
    toast(e.message, "⚠️");
  } finally {
    loadingOrdersStats = false;
  }
}

if (window.ztBus) {
  window.ztBus.on("dash:tab", (tab) => {
    if (tab === "delivery") loadOrdersStats();
  });
  window.ztBus.on("dash:refresh", () => {
    if (isDeliveryPaneActive()) loadOrdersStats();
  });
}

window.loadOrdersStats = loadOrdersStats;
