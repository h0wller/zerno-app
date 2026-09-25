/* public/app/core/promo.js — Ф5.7: кластер "promo" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
/* ── промокоды ── */
      $("#promoBtn").onclick = async () => {
        const code = $("#promoInput").value.trim();
        if (!code) return toast("Введите промокод", "🎟");
        try {
          const r = await api("/promo/redeem", {
            method: "POST",
            body: { code },
          });
          me = r.customer;
          renderBonus();
          renderProfile();
          confetti();
          toast(r.msg, "🎉");
          $("#promoInput").value = "";
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      $("#promoToggle").onclick = () => {
        $("#promoModal").classList.add("show");
        syncOverlay();
        loadPromos();
        loadWeekPromo();
      };
      function closePromo() {
        $("#promoModal").classList.remove("show");
        syncOverlay();
      }
      $("#promoClose").onclick = closePromo;

      $("#pmList").addEventListener("click", async (e) => {
        const t = e.target.closest("[data-pt]"),
          d = e.target.closest("[data-pd]");
        if (t) {
          await api("/promos/" + t.dataset.pt + "/toggle", { method: "POST" });
          loadPromos();
        }
        if (d) {
          if (confirm("Удалить промокод?")) {
            await api("/promos/" + d.dataset.pd, { method: "DELETE" });
            loadPromos();
          }
        }
      });

      $("#pmCreate").onclick = async () => {
        const body = {
          code: $("#pmCode").value,
          kind: $("#pmKind").value,
          value: +$("#pmValue").value || 1,
          days: +$("#pmDays").value || 0,
          maxuses: +$("#pmMax").value || 0,
        };
        try {
          await api("/promos", { method: "POST", body });
          $("#pmCode").value = "";
          loadPromos();
          toast("Промокод создан — делитесь кодом!", "🎟");
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      async function loadWeekPromo() {
        try {
          const d = await fetch(API_BASE + "/api/delivery/info").then((r) =>
            r.json(),
          );
          const w = d.weekPromo || {};
          $("#wpText").value = w.text || "";
          $("#wpThreshold").value = w.threshold || 0;
          $("#wpGift").value = w.gift || "";
          $("#wpUntil").value = w.until ? w.until.slice(0, 10) : "";
          $("#pmName").value = (d.pizzaMonth && d.pizzaMonth.name) || "";
          $("#pmOn").checked = !!d.pizzaMonth;
        } catch (e) {}
      }

      $("#wpSave").onclick = async () => {
        try {
          await api("/admin/weekpromo", {
            method: "PUT",
            body: {
              text: $("#wpText").value.trim(),
              threshold: +$("#wpThreshold").value || 0,
              gift: $("#wpGift").value.trim(),
              until: $("#wpUntil").value
                ? new Date($("#wpUntil").value + "T23:59:59").toISOString()
                : null,
              push: $("#wpPush").checked,
            },
          });
          $("#wpPush").checked = false;
          toast("Пятничный подарок сохранён", "🍕");
          loadDelivery();
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      $("#pmSave").onclick = async () => {
        try {
          await api("/admin/weekpromo", {
            method: "PUT",
            body: {
              pmName: $("#pmName").value.trim(),
              pmOn: $("#pmOn").checked,
            },
          });
          toast("Пицца месяца сохранена", "🍕");
          loadDelivery();
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      