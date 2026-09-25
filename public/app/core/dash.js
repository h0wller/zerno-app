/* public/app/core/dash.js — Ф5.7: кластер "dash" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
/* ── дашборд ── */
      $("#dashToggle").onclick = async () => {
        $("#dashModal").classList.add("show");
        syncOverlay();
        window.loadSubs();
        try {
          const s = await api("/stats");
          $("#dashTop").innerHTML = `
     <div class="stat"><b>${s.total}</b><span>всего гостей</span></div>
     <div class="stat"><b>${s.newWeek}</b><span>новых за 7 дн</span></div>
     <div class="stat"><b>${s.returning}</b><span>возвращаются</span></div>`;
          const max = Math.max(1, ...s.days.map((d) => d.c));
          $("#dashChart").innerHTML = s.days
            .map(
              (
                d,
              ) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0">
      <div style="width:100%;background:${d.c ? "var(--flame)" : "#E7ECF0"};border-radius:6px;height:${Math.round(6 + (104 * d.c) / max)}px" title="${d.label}: ${d.c}"></div>
      <small style="font-size:9px;color:#8B98A5">${d.label}</small></div>`,
            )
            .join("");
          $("#dashMore").innerHTML = `
     <div class="hmini">Штампы: сегодня <b>${s.stampsToday}</b> · за 7 дн <b>${s.stampsWeek}</b> · за 30 дн <b>${s.stampsMonth}</b></div>
     <div class="hmini">Бесплатных кофе списано за 30 дн: <b>${s.redeemed}</b> · новых гостей за 30 дн: <b>${s.newMonth}</b></div>
     <div class="hmini">Средняя чашек на гостя: <b>${s.avgCups}</b> · активаций промокодов: <b>${s.promoUses}</b></div>`;
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      async function loadSubs() {
        try {
          const ps = await api("/push/subs");
          const m = {};
          (ps.subs || []).forEach((s) => {
            const k = (s.phone || "") + "|" + (s.name || "—");
            const g = (m[k] = m[k] || {
              name: s.name,
              phone: s.phone,
              web: 0,
              tg: 0,
              webTs: null,
              tgTs: null,
            });
            g.web++;
            if (!g.webTs) g.webTs = s.created;
          });
          (ps.tg || []).forEach((s) => {
            const k = (s.phone || "") + "|" + (s.name || "—");
            const g = (m[k] = m[k] || {
              name: s.name,
              phone: s.phone,
              web: 0,
              tg: 0,
              webTs: null,
              tgTs: null,
            });
            g.tg++;
            if (!g.tgTs) g.tgTs = s.created;
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
                g.webTs
                  ? `пуш с ${new Date(g.webTs).toLocaleDateString("ru-RU")}`
                  : "",
                g.tgTs
                  ? `TG с ${new Date(g.tgTs).toLocaleDateString("ru-RU")}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return `<div class="hmini" title="${esc(ttl)}"><b>${esc(g.name || "—")}</b> · ${esc(g.phone || "")} · ${tags}</div>`;
            })
            .join("");
          $("#pushSubs").innerHTML =
            rows || '<div class="hmini">Пока никто не подписан</div>';
        } catch (e) {}
      }

      function closeDash() {
        $("#dashModal").classList.remove("show");
        syncOverlay();
      }
      $("#dashClose").onclick = closeDash;

      
/* ── Ф5.6.2c: ESM-шим: явные window-экспорты для классик-потребителей ── */
window.loadSubs = loadSubs;
window.closeDash = closeDash;
