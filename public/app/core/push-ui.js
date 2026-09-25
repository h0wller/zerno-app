/* public/app/core/push-ui.js — Ф5.7: кластер "push-ui" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
function urlBase64ToUint8Array(s) {
        const padding = "=".repeat((4 - (s.length % 4)) % 4);
        const b64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64);
        const out = new Uint8Array(raw.length);
        for (window.i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
        return out;
      }

      let pushBusy = false;
      async function enablePush() {
        if (pushBusy) return toast("Секунду, включаю…", "⏳");
        pushBusy = true;
        try {
          if (isCap) {
            const PN = Capacitor.Plugins.PushNotifications;
/* Ф5.6.2g: разделяемое состояние с fx.js через window */
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
              applicationServerKey: window.urlBase64ToUint8Array(v.publicKey),
            });
          } catch (e) {
            sub = await reg.pushManager.getSubscription();
            if (!sub) throw e;
          }
          await api("/push/subscribe", {
            method: "POST",
            body: { sub: sub.toJSON() },
          });
          window.refreshPushBtn();
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
          window.togglePushHint(false);
        };
        if (isCap) {
          const needPush = me && localStorage.getItem("zt_fcm") !== "1";
          pb.hidden = !needPush;
          if (av) av.classList.toggle("pulse-hint", !!needPush);
          window.togglePushHint(!!needPush);
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
          window.togglePushHint(need);
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
                  applicationServerKey: window.urlBase64ToUint8Array(v.publicKey),
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
          window.refreshPushBtn();
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

      
      
/* ── Ф5.6.2g: ESM-шимы ── */
window.enablePush = enablePush;
window.togglePushHint = togglePushHint;
window.refreshPushBtn = refreshPushBtn;
window.urlBase64ToUint8Array = urlBase64ToUint8Array;
