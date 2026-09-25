/* public/app/core/editor.js — Ф5.7: кластер "editor" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
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
window.edit = null; /* Ф5.6.2f: разделяемое состояние с menu-editor.js через window */
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
            window.renderZone();
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
        if (e.dataTransfer.files[0]) window.loadImg(e.dataTransfer.files[0]);
      });
      $("#emFile").addEventListener("change", (e) => {
        if (e.target.files[0]) window.loadImg(e.target.files[0]);
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
          window.renderZone();
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
        window.closeEditor();
        openEditor(c.id);
        toast("Дубликат подготовлен — нажмите «Сохранить»", "⧉");
      };

      $("#emDel").onclick = async () => {
        if (!confirm("Удалить позицию из меню?")) return;
        try {
          await api("/menu/" + edit.id, { method: "DELETE" });
          await loadMenu();
          window.closeEditor();
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

      
/* ── Ф5.6.2f: ESM-шимы ── */
window.armPw = armPw;
window.renderZone = renderZone;
window.closeEditor = closeEditor;
window.loadImg = loadImg;
