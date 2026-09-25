"use strict";

      /* ── меню ── */
      async function loadMenu() {
        try {
          const r = await api(
            me && me.role === "admin" ? "/menu/all" : "/menu",
          );
          MENU = r.items;
          meta.updatedAt = r.updatedAt;
          renderUpd();
          renderMenu();
        } catch (e) {
          toast(e.message, "⚠️");
        }
      }

      let modeSegBound = false;
      function renderModes() {
        const role = me ? me.role : "guest";
        const btns = [{ m: "guest", l: "Гость" }];
        if (role === "cashier" || role === "admin")
          btns.push({ m: "cashier", l: "Кассир" });
        if (role === "dispatch" || role === "cashier" || role === "admin")
          btns.push({ m: "orders", l: "🍕 Заказы" });
        if (role === "admin") btns.push({ m: "admin", l: "Админ" });
        const seg = $("#modeSeg");
        seg.innerHTML = btns
          .map(
            (b) =>
              `<button data-mode="${b.m}" class="${mode === b.m ? "on" : ""}">${b.l}</button>`,
          )
          .join("");
        seg.hidden = btns.length < 2;
        if (!modeSegBound) {
          modeSegBound = true;
          seg.addEventListener("click", (e) => {
            const b = e.target.closest("[data-mode]");
            if (b) setMode(b.dataset.mode);
          });
        }
      }

      function setMode(m) {
        const role = me ? me.role : "guest";
        if (m === "cashier" && role !== "cashier" && role !== "admin") return;
        if (
          m === "orders" &&
          role !== "dispatch" &&
          role !== "cashier" &&
          role !== "admin"
        )
          return;
        if (m === "admin" && role !== "admin") return;
        mode = m;
        document.body.classList.toggle(
          "is-cashier",
          m === "cashier" || m === "orders",
        );
        const cv = $("#cashierView");
        if (cv) cv.hidden = m !== "cashier";
        const ov = $("#ordersView");
        if (ov) ov.hidden = m !== "orders";
        syncBrandViews();
        const ab = $("#adminBar");
        if (ab) ab.hidden = m !== "admin";
        const pt = $("#promoToggle");
        if (pt) pt.hidden = m !== "admin";
        const dt = $("#dashToggle");
        if (dt) dt.hidden = m !== "admin";
        const ct = $("#chatsToggle2");
        if (ct)
          ct.hidden = !(me && (me.role === "admin" || me.role === "cashier"));
        const bd = $("#adminBadge");
        if (bd) bd.hidden = m !== "admin";
        if (m !== "admin") exitEdit();
        $("#mbonusBtn").style.display =
          m === "cashier" || m === "orders" ? "none" : "";
        const cf = $("#cartFab");
        if (cf) cf.style.display = m === "guest" ? "" : "none";
        if (m === "cashier") renderLog();
        if (m === "orders") {
          renderOrders();
          if (!ordersPoll)
            ordersPoll = setInterval(() => {
              if (mode === "orders") renderOrders(true);
            }, 8000);
        }
        if (m === "admin") loadMenu();
        if (
          (m === "guest" || m === "admin") &&
          brand === "delivery" &&
          !DMENU.length
        )
          loadDelivery();
        renderModes();
        toast(
          m === "admin"
            ? "Режим администратора активен"
            : m === "cashier"
              ? "Смена кассира активна"
              : m === "orders"
                ? "Панель диспетчера"
                : "Режим гостя",
          m === "admin"
            ? "🔓"
            : m === "cashier"
              ? "🧾"
              : m === "orders"
                ? "🍕"
                : "",
        );
      }

      function syncBrandViews() {
        const isDel = brand === "delivery";
        const bName = isDel ? "delivery" : "coffee";

        // 1. Принудительно выставляем актуальный бренд на html и body
        document.documentElement.setAttribute("data-brand", bName);
        document.body.setAttribute("data-brand", bName);

        // 2. Синхронизируем активную кнопку в переключателе
        const bSeg = document.getElementById("brandSeg");
        if (bSeg) {
          bSeg.querySelectorAll("button").forEach((btn) => {
            btn.classList.toggle("on", btn.dataset.brand === bName);
          });
        }

        // 3. Переключаем видимость меню
        const showGuest = mode === "guest" || mode === "admin";
        const mv = document.getElementById("menuView");
        const dv = document.getElementById("deliveryView");
        const rl = document.getElementById("rail");

        if (mv) mv.hidden = !showGuest || isDel;
        if (dv) dv.classList.toggle("active", showGuest && isDel);
        if (rl) rl.style.display = mv && mv.hidden ? "none" : "";

        const et = document.getElementById("editToggle");
        if (et) et.hidden = !(mode === "admin" && !isDel);

        // 4. Обновляем корзину и плавающую кнопку
        if (typeof window.cartFabShow === "function") window.cartFabShow();
        if (typeof window.updateDeliveryPromoBar === "function")
          window.updateDeliveryPromoBar();
      }
      function openPin() {
        armPw();
        $("#pinModal").classList.add("show");
        syncOverlay();
        setTimeout(() => $("#pinInput").focus(), 150);
      }
      function closePin() {
        $("#pinModal").classList.remove("show");
        $("#pinInput").value = "";
        syncOverlay();
      }
      $("#pinClose").onclick = closePin;

      async function tryActivate() {
        const v = $("#pinInput").value.trim();
        if (!v) return toast("Введите код", "✍️");
        try {
          const r = await api("/auth/activate", {
            method: "POST",
            body: { code: v },
          });
          me = r.customer;
          closePin();
          renderModes();
          renderProfile();
          toast(
            me.role === "admin"
              ? "🔓 Вы теперь администратор"
              : me.role === "dispatch"
                ? "🛵 Вы диспетчер доставки"
                : "🧾 Вы теперь кассир",
            "✅",
          );
        } catch (e) {
          if (e.code === 429) {
            let sec = parseInt((e.message.match(/\d+/) || ["60"])[0], 10);
            const btn = $("#pinGo");
            btn.disabled = true;
            btn.textContent = `Подождите ${sec}…`;
            toast(e.message, "⏳");
            const t = setInterval(() => {
              sec--;
              if (sec <= 0) {
                clearInterval(t);
                btn.disabled = false;
                btn.textContent = "Активировать";
              } else btn.textContent = `Подождите ${sec}…`;
            }, 1000);
          } else {
            const p = $("#pinInput");
            p.classList.remove("err");
            void p.offsetWidth;
            p.classList.add("err");
            toast(e.message, "⛔");
            p.value = "";
          }
        }
      }
      $("#pinGo").onclick = tryActivate;

      document.addEventListener("submit", (e) => {
        e.preventDefault();
        if (e.submitter) return;
        if (e.target.id === "regForm") $("#regBtn").click();
        else if (e.target.id === "loginForm") $("#logBtn").click();
        else if (e.target.id === "pinForm") $("#pinGo").click();
        else if (e.target.id === "setPinForm") $("#setPinGo").click();
      });

      document.getElementById("grid").addEventListener("click", (e) => {
        const card = e.target.closest(".card");
        if (!card || e.target.closest("button, a, input")) return;
        const targetBtn = card.querySelector(".cfoot button, [data-ed]");
        if (targetBtn) targetBtn.click();
      });

      document.addEventListener("focusin", (e) => {
        const t = e.target;
        if (
          t &&
          t.tagName === "INPUT" &&
          t.closest("[hidden], .modal:not(.show)")
        )
          t.blur();
      });
      addEventListener("load", () => {
        const a = document.activeElement;
        if (
          a &&
          a.tagName === "INPUT" &&
          a.closest("[hidden], .modal:not(.show)")
        )
          a.blur();
      });

      $("#activateBtn").onclick = openPin;
      $("#setPinBtn").onclick = () => openSetPin("change");

      function armPw() {
        ["regPin", "logPin", "logOtp", "setPinInput", "pinInput"].forEach(
          (id) => {
            const el = document.getElementById(id);
            if (el) el.type = "password";
          },
        );
      } 
      $("#grid").addEventListener("click", (e) => {
        const b = e.target.closest("[data-ed]");
        if (b) openEditor(b.dataset.ed);
      });
      let edit = null;
      $("#emCat").innerHTML = CATS.map(
        (c) => `<option value="${c.id}">${c.e} ${c.l}</option>`,
      ).join("");

      function renderZone() {
        const z = $("#emZone");
        z.innerHTML = edit.img
          ? `<img src="${edit.img}" alt=""><button type="button" class="zdel" id="emImgDel">✕ убрать фото</button>`
          : `<div class="zempty"><span>📷</span><b>Загрузить фото</b><small>JPG/PNG · перетащите или кликните</small></div>`;
        const d = $("#emImgDel");
        if (d)
          d.onclick = (e) => {
            e.stopPropagation();
            edit.img = null;
            renderZone();
          };
      }

      function closeEditor() {
        $("#emModal").classList.remove("show");
        syncOverlay();
      }
      $("#emClose").onclick = closeEditor;
      $("#emZone").onclick = () => $("#emFile").click();
      $("#emZone").addEventListener("dragover", (e) => {
        e.preventDefault();
        $("#emZone").classList.add("over");
      });
      $("#emZone").addEventListener("dragleave", () =>
        $("#emZone").classList.remove("over"),
      );
      $("#emZone").addEventListener("drop", (e) => {
        e.preventDefault();
        $("#emZone").classList.remove("over");
        if (e.dataTransfer.files[0]) loadImg(e.dataTransfer.files[0]);
      });
      $("#emFile").addEventListener("change", (e) => {
        if (e.target.files[0]) loadImg(e.target.files[0]);
        e.target.value = "";
      });

      function loadImg(file) {
        const u = URL.createObjectURL(file),
          img = new Image();
        img.onload = () => {
          const m = Math.min(1, 640 / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * m);
          c.height = Math.round(img.height * m);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          edit.img = c.toDataURL("image/jpeg", 0.82);
          URL.revokeObjectURL(u);
          renderZone();
        };
        img.onerror = () => {
          URL.revokeObjectURL(u);
          toast("Не удалось прочитать файл", "⚠️");
        };
        img.src = u;
      }

      $("#emDup").onclick = () => {
        const c = clone(edit);
        delete c.id;
        c.name += " (копия)";
        MENU.push(c);
        renderMenu();
        closeEditor();
        openEditor(c.id);
        toast("Дубликат подготовлен — нажмите «Сохранить»", "⧉");
      };

      $("#emDel").onclick = async () => {
        if (!confirm("Удалить позицию из меню?")) return;
        try {
          await api("/menu/" + edit.id, { method: "DELETE" });
          await loadMenu();
          closeEditor();
          toast("Позиция удалена", "🗑");
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      $("#nameInput").addEventListener("change", async (e) => {
        if (!me) return;
        const name = e.target.value.trim() || "Гость";
        try {
          const r = await api("/me", { method: "PUT", body: { name } });
          me = r.customer;
          renderProfile();
          toast("Профиль обновлён", "✅");
        } catch (err) {
          toast(err.message, "⚠️");
        }
      });

      $("#resetBtn").onclick = () => {
        if (!confirm("Выйти и очистить локальные данные (токены)?")) return;
        localStorage.clear();
        location.reload();
      };

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

      /* ── дашборд ── */
      $("#dashToggle").onclick = async () => {
        $("#dashModal").classList.add("show");
        syncOverlay();
        loadSubs();
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

      function urlBase64ToUint8Array(s) {
        const padding = "=".repeat((4 - (s.length % 4)) % 4);
        const b64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64);
        const out = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
        return out;
      }

      let pushBusy = false;
      async function enablePush() {
        if (pushBusy) return toast("Секунду, включаю…", "⏳");
        pushBusy = true;
        try {
          if (isCap) {
            const PN = Capacitor.Plugins.PushNotifications;
            const perm = await PN.requestPermissions();
            if (perm.receive !== "granted")
              return toast("Уведомления не включены", "😔");
            PN.register();
            return toast("Уведомления включены!", "🔔");
          }
          const isIOS =
            /iP(hone|ad|od)/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
          const standalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            navigator.standalone;
          if (isIOS && !standalone) {
            toast(
              'На iPhone пуши работают после установки: Поделиться → «На экран "Домой"», затем включите уведомления в профиле',
              "📲",
              null,
            );
            return;
          }
          if (!("Notification" in window) || !("PushManager" in window))
            return toast("Браузер не поддерживает уведомления", "⚠️");
          let perm = Notification.permission;
          if (perm === "default") perm = await Notification.requestPermission();
          if (perm !== "granted")
            return toast(
              "Разрешение не выдано — включи уведомления для сайта в настройках iPhone",
              "😔",
            );
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, rej) =>
              setTimeout(
                () => rej(new Error("SW не готов — обнови страницу")),
                8000,
              ),
            ),
          ]);
          const v = await (await fetch(API_BASE + "/api/vapid")).json();
          let sub = null;
          try {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(v.publicKey),
            });
          } catch (e) {
            sub = await reg.pushManager.getSubscription();
            if (!sub) throw e;
          }
          await api("/push/subscribe", {
            method: "POST",
            body: { sub: sub.toJSON() },
          });
          refreshPushBtn();
          toast("Готово! Проверочный пуш уже летит", "🔔");
        } catch (e) {
          toast(
            (e && e.message) ||
              "Не удалось включить пуши — обнови страницу и попробуй ещё раз",
            "⚠️",
          );
        } finally {
          pushBusy = false;
        }
      }

      function togglePushHint(show) {
        let h = document.getElementById("pushHint");
        if (!show && h) {
          h.remove();
          return;
        }
        if (show && !h) {
          setTimeout(() => {
            if (document.getElementById("pushHint")) return;
            const pb2 = $("#pushBtn");
            if (pb2 && pb2.hidden) return;
            const nh = document.createElement("div");
            nh.id = "pushHint";
            nh.className = "pushHint";
            nh.innerHTML = "🔔 Включите пуши тут →";
            const av = $("#profileTopBtn");
            if (av) {
              nh.style.position = "fixed";
              nh.style.top = "58px";
              nh.style.right = "16px";
            }
            nh.onclick = () => {
              const a2 = $("#profileTopBtn");
              if (a2) a2.click();
              nh.remove();
              setTimeout(() => {
                const pb = $("#pushBtn");
                if (pb && !pb.hidden) {
                  pb.classList.add("glow");
                  setTimeout(() => {
                    pb.classList.remove("glow");
                  }, 6000);
                }
              }, 450);
            };
            document.body.appendChild(nh);
          }, 4000);
        }
      }

      function refreshPushBtn() {
        const pb = $("#pushBtn");
        const av = $("#profileTopBtn");
        if (!pb) return;
        const hide = () => {
          pb.hidden = true;
          if (av) av.classList.remove("pulse-hint");
          togglePushHint(false);
        };
        if (isCap) {
          const needPush = me && localStorage.getItem("zt_fcm") !== "1";
          pb.hidden = !needPush;
          if (av) av.classList.toggle("pulse-hint", !!needPush);
          togglePushHint(!!needPush);
          return;
        }
        const ua = navigator.userAgent;
        const ios =
          /iP(hone|ad|od)/.test(ua) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          navigator.standalone;
        const inApp = /(Telegram|Instagram|FBAN|FBAV|VK|WhatsApp|Twitter)/.test(
          ua,
        );
        if (
          !me ||
          !("Notification" in window) ||
          !("PushManager" in window) ||
          !("serviceWorker" in navigator)
        )
          return hide();
        if ((ios && !standalone) || inApp) return hide();
        let done = false;
        const apply = (need) => {
          if (done) return;
          done = true;
          pb.hidden = !need;
          if (av) av.classList.toggle("pulse-hint", need);
          togglePushHint(need);
        };
        const t = setTimeout(() => apply(false), 3000);
        navigator.serviceWorker.ready
          .then(async (reg) => {
            try {
              let s = await reg.pushManager.getSubscription();
              if (!s && Notification.permission === "granted") {
                const v = await (await fetch(API_BASE + "/api/vapid")).json();
                s = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(v.publicKey),
                });
                await api("/push/subscribe", {
                  method: "POST",
                  body: { sub: s.toJSON() },
                });
              }
              clearTimeout(t);
              apply(!s);
            } catch (e) {
              clearTimeout(t);
              apply(false);
            }
          })
          .catch(() => {
            clearTimeout(t);
            apply(false);
          });
      }
      $("#pushBtn").onclick = enablePush;

      const isCap = !!(
        window.Capacitor &&
        Capacitor.Plugins &&
        Capacitor.Plugins.PushNotifications
      );
      if (isCap) {
        const PN = Capacitor.Plugins.PushNotifications;
        PN.addListener("registration", (t) => {
          localStorage.setItem("zt_fcm", "1");
          localStorage.setItem("zt_fcm_token", t.value);
          if (me)
            api("/push/fcm", {
              method: "POST",
              body: { token: t.value },
            }).catch(() => {});
          refreshPushBtn();
        });
        try {
          PN.register();
        } catch (e) {}
      }

      $("#pushSend").onclick = async () => {
        const body = $("#pushText").value.trim();
        if (!body) return toast("Введите текст пуша", "✍️");
        if (!confirm("Отправить пуш всем подписчикам?")) return;
        try {
          const r = await api("/push/send", { method: "POST", body: { body } });
          toast(`Отправлено гостям: ${r.sent}`, "🔔");
          $("#pushText").value = "";
        } catch (e) {
          toast(e.message, "⚠️");
        }
      };

      const fx = $("#fx"),
        fxx = fx.getContext("2d");
      let pieces = [],
        fxOn = false;
      function fitFx() {
        fx.width = innerWidth;
        fx.height = innerHeight;
      }
      fitFx();
      addEventListener("resize", fitFx);
      function confetti() {
        const C = ["#1F4E8C", "#7FB2D9", "#C89B6A", "#BBD6EE", "#F5F2EC"];
        for (let i = 0; i < 90; i++)
          pieces.push({
            x: Math.random() * fx.width,
            y: -20 - Math.random() * 80,
            vy: 2 + Math.random() * 3.5,
            vx: (Math.random() - 0.5) * 2,
            s: 5 + Math.random() * 6,
            r: Math.random() * 6.3,
            vr: (Math.random() - 0.5) * 0.3,
            c: C[i % C.length],
          });
        if (!fxOn) {
          fxOn = true;
          loop();
        }
      }

      function loop() {
        fxx.clearRect(0, 0, fx.width, fx.height);
        pieces = pieces.filter((p) => p.y < fx.height + 30);
        pieces.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
          fxx.save();
          fxx.translate(p.x, p.y);
          fxx.rotate(p.r);
          fxx.fillStyle = p.c;
          fxx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
          fxx.restore();
        });
        pieces.length
          ? requestAnimationFrame(loop)
          : ((fxOn = false), fxx.clearRect(0, 0, fx.width, fx.height));
      }

      let histPushed = false;
      function syncOverlay() {
        const ov = document.getElementById("overlay");
        const panel = document.getElementById("panel");
        if (!ov) return;
        const on =
          !!document.querySelector(".modal.show") ||
          !!(panel && panel.classList.contains("open"));
        ov.classList.toggle("show", on);
        ov.style.pointerEvents = on ? "auto" : "none";
        ov.setAttribute("aria-hidden", on ? "false" : "true");
        if (on && !histPushed) {
          histPushed = true;
          try {
            history.pushState({ zerno: 1 }, "");
          } catch (e) {}
        } else if (!on && histPushed) {
          histPushed = false;
          try {
            history.back();
          } catch (e) {}
        }
      }

      addEventListener("popstate", () => {
        if (!histPushed) return;
        histPushed = false;
        closePanel();
        closeEditor();
        closeAuth();
        closePin();
        closeQRFull();
        closePromo();
        closeDash();
        closeStaffChat();
      });

      $("#overlay").onclick = () => {
        closePanel();
        closeEditor();
        closePin();
        closeSetPin();
        closeQRFull();
        closePromo();
        closeDash();
        if (onboarded || me) closeAuth();
      };

      addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closePanel();
          closeEditor();
          closePin();
          closeSetPin();
          closeQRFull();
          closePromo();
          closeDash();
          $("#chatPanel").classList.remove("open");
          if (onboarded || me) closeAuth();
        }
      });
      $("#brandSeg").addEventListener("click", (e) => {
        const b = e.target.closest("[data-brand]");
        if (!b) return;
        brand = b.dataset.brand;
        if (mode === "cashier" || mode === "orders") setMode("guest");
        syncBrandViews();
        if (brand === "delivery" && !DMENU.length) loadDelivery();
      });
