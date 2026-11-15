/* public/app/core/staffpin.js — Ф5.7: кластер "staffpin" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
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
          window.closePin();
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

      
/* ── Ф5.6.2e: ESM-шим: явные window-экспорты для классик-потребителей ── */
window.openPin = openPin;
window.closePin = closePin;
window.tryActivate = tryActivate;
