// apply-all-fixes.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function log(msg) {
  console.log(`\x1b[32m✔\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
}

function updateFile(relPath, mutator) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) {
    warn(`Файл не найден: ${relPath}`);
    return false;
  }
  const oldContent = fs.readFileSync(abs, 'utf8');
  const newContent = mutator(oldContent);
  if (oldContent !== newContent) {
    fs.writeFileSync(abs, newContent, 'utf8');
    log(`Обновлен: ${relPath}`);
    return true;
  } else {
    log(`Без изменений: ${relPath}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. public/app/core/overlay-core.js: Haptics, MainButton, BackButton & Native UX
// ─────────────────────────────────────────────────────────────────────────────
const overlayCoreContent = `/* public/app/core/overlay-core.js — Ф5.7: кластер "overlay-core" из legacy-core.js. Top-level = global. */
let histPushed = false;

function syncOverlay() {
  const ov = document.getElementById("overlay");
  const panel = document.getElementById("panel");
  const cartPanel = document.getElementById("cartPanel");
  if (!ov) return;

  if (window.TgUx && typeof window.TgUx.updateMainButton === "function") {
    window.TgUx.updateMainButton();
  }

  const on =
    !!document.querySelector(".modal.show") ||
    !!(panel && panel.classList.contains("open")) ||
    !!(cartPanel && cartPanel.classList.contains("open"));

  ov.classList.toggle("show", on);

  const isMiniApp =
    window.TgUx && typeof window.TgUx.isTg === "function"
      ? window.TgUx.isTg()
      : false;

  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.BackButton && isMiniApp) {
      if (on) {
        tg.BackButton.show();
        document.documentElement.classList.add("tg-native-back");
      } else {
        tg.BackButton.hide();
        document.documentElement.classList.remove("tg-native-back");
      }
    }
  } catch (_) {}

  ov.style.pointerEvents = on ? "auto" : "none";
  ov.setAttribute("aria-hidden", on ? "false" : "true");

  // Управление history pushState/back вызывается ТОЛЬКО внутри Telegram Mini App
  if (isMiniApp) {
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
  if (typeof closeStaffChat === "function") closeStaffChat();
  const cartPanel = document.getElementById("cartPanel");
  if (cartPanel) cartPanel.classList.remove("open");
});

$("#overlay").onclick = () => {
  closePanel();
  closeEditor();
  closePin();
  closeSetPin();
  closeQRFull();
  closePromo();
  closeDash();
  const cartPanel = document.getElementById("cartPanel");
  if (cartPanel) cartPanel.classList.remove("open");
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
    const cartPanel = document.getElementById("cartPanel");
    if (cartPanel) cartPanel.classList.remove("open");
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

window.syncOverlay = syncOverlay;

/* TG-UX-OBJECT-PATCH v2 */
(function () {
  const getTg = () =>
    (typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp) ||
    null;

  function isTg() {
    if (window.__isTgMiniApp) return true;
    const tg = getTg();
    if (!tg) return false;
    return !!(
      (tg.initData && tg.initData.length > 0) ||
      (tg.initDataUnsafe &&
        (tg.initDataUnsafe.query_id || tg.initDataUnsafe.user)) ||
      (tg.platform && tg.platform !== "unknown") ||
      /tgWebAppData=/.test(location.hash) ||
      new URLSearchParams(location.search).get("src") === "tg"
    );
  }

  function ensureTgEnvironment() {
    if (!isTg()) return;
    const tg = getTg();
    if (tg) {
      try {
        if (typeof tg.ready === "function") tg.ready();
        if (typeof tg.expand === "function") tg.expand();
      } catch (_) {}
    }

    if (!document.getElementById("tgUxNativeCss")) {
      const st = document.createElement("style");
      st.id = "tgUxNativeCss";
      st.textContent = \`
        html.tg-native-main #checkoutBtn { display: none !important; }
      \`;
      document.head.appendChild(st);
    }
  }

  function haptic(style = "light") {
    if (!isTg()) return;

    try {
      window.__tgEvents = window.__tgEvents || {};
      if (!Array.isArray(window.__tgEvents.hapticCalls))
        window.__tgEvents.hapticCalls = [];
      window.__tgEvents.hapticCalls.push(style);
    } catch (_) {}

    const tg = getTg();
    if (!tg || !tg.HapticFeedback) return;

    try {
      if (style === "success" || style === "error" || style === "warning") {
        tg.HapticFeedback.notificationOccurred(style);
      } else if (style === "selection") {
        tg.HapticFeedback.selectionChanged();
      } else {
        const allowed = ["light", "medium", "heavy", "rigid", "soft"];
        tg.HapticFeedback.impactOccurred(
          allowed.includes(style) ? style : "light"
        );
      }
    } catch (_) {}
  }

  function getCartSummary() {
    const list =
      typeof window.cart !== "undefined" && Array.isArray(window.cart)
        ? window.cart
        : [];
    const count = list.reduce((acc, c) => acc + (Number(c.qty) || 1), 0);

    let total = 0;
    if (typeof window.totalsNow === "function") {
      try {
        const t = window.totalsNow();
        if (t && Number(t.total) > 0) total = Number(t.total);
      } catch (_) {}
    }
    if (!total) {
      const el = document.getElementById("cartTotal");
      if (el) {
        total = Number(String(el.textContent || "").replace(/\\D/g, "")) || 0;
      }
    }
    if (!total) {
      total = list.reduce(
        (acc, c) => acc + (Number(c.price) || 0) * (Number(c.qty) || 1),
        0
      );
    }
    return { count, total };
  }

  function updateMainButton() {
    if (!isTg()) {
      document.documentElement.classList.remove("tg-native-main");
      return;
    }
    const tg = getTg();
    const mb = tg && tg.MainButton;
    if (!mb) return;

    const cartPanel = document.getElementById("cartPanel");
    const isCartOpen = !!(cartPanel && cartPanel.classList.contains("open"));
    const { count, total } = getCartSummary();
    const shouldShow = isCartOpen && count > 0 && total > 0;

    if (shouldShow) {
      document.documentElement.classList.add("tg-native-main");
      const isDeliv =
        typeof window.brand !== "undefined" && window.brand === "delivery";
      const btnColor = isDeliv ? "#C03B2A" : "#123A6B";
      const text = \`Оформить заказ · \${total.toLocaleString("ru-RU")} ₽\`;

      try {
        if (typeof mb.setParams === "function") {
          mb.setParams({
            text: text,
            color: btnColor,
            text_color: "#FFFFFF",
            is_active: true,
            is_visible: true,
          });
        } else {
          mb.setText(text);
          mb.show();
        }
      } catch (_) {}
    } else {
      document.documentElement.classList.remove("tg-native-main");
      try {
        mb.hide();
      } catch (_) {}
    }
  }

  function closeTop() {
    haptic("light");
    const openModal = document.querySelector(".modal.show");
    if (openModal) {
      openModal.classList.remove("show");
    } else {
      const cartPanel = document.getElementById("cartPanel");
      if (cartPanel && cartPanel.classList.contains("open")) {
        cartPanel.classList.remove("open");
      }
      const panel = document.getElementById("panel");
      if (panel && panel.classList.contains("open")) {
        panel.classList.remove("open");
      }
      const chatPanel = document.getElementById("chatPanel");
      if (chatPanel && chatPanel.classList.contains("open")) {
        chatPanel.classList.remove("open");
      }
    }

    if (typeof window.syncOverlay === "function") {
      window.syncOverlay();
    }
    updateMainButton();
  }

  const TgUx = {
    isTg: isTg,
    closeTop: closeTop,
    success: () => haptic("success"),
    impact: (style = "light") => haptic(style),
    haptic: (style = "light") => haptic(style),
    notify: (type = "success") => haptic(type),
    syncMainButton: updateMainButton,
    updateMainButton: updateMainButton,
    sync: function () {
      if (typeof window.syncOverlay === "function") window.syncOverlay();
      updateMainButton();
    },
  };

  window.TgUx = TgUx;

  try {
    const tg = getTg();
    if (tg && tg.MainButton) {
      const onMainClick = function () {
        haptic("medium");
        const btn = document.getElementById("checkoutBtn");
        if (btn) btn.click();
      };
      if (typeof tg.MainButton.onClick === "function") {
        tg.MainButton.onClick(onMainClick);
      } else if (typeof tg.MainButton.onEvent === "function") {
        tg.MainButton.onEvent("clicked", onMainClick);
      }
    }
  } catch (_) {}

  try {
    const tg = getTg();
    if (tg && tg.BackButton) {
      const onBackClick = function () {
        closeTop();
      };
      if (typeof tg.BackButton.onClick === "function") {
        tg.BackButton.onClick(onBackClick);
      } else if (typeof tg.BackButton.onEvent === "function") {
        tg.BackButton.onEvent("clicked", onBackClick);
      }
    }
  } catch (_) {}

  document.addEventListener(
    "click",
    function (e) {
      if (!isTg()) return;
      const t = e.target;
      if (!t || typeof t.closest !== "function") return;

      if (
        t.closest(
          ".qty button, [data-step], .step, [data-act], #deliveryRail button, #brandSeg button, .rail button, .tabs button, [data-brand]"
        )
      ) {
        haptic("light");
        return;
      }

      if (
        t.closest(
          ".addBtn, .cta.add, [data-addon], #deliveryGrid .card .cta, #deliveryGrid .opts button, .cfoot button"
        )
      ) {
        haptic("medium");
        return;
      }
    },
    true
  );

  if (typeof window.toast === "function") {
    const rawToast = window.toast;
    window.toast = function (msg, icon) {
      if (isTg()) {
        if (
          icon === "🎉" ||
          icon === "✅" ||
          (msg && /оформлен|успешно|принят|сохранен/i.test(msg))
        ) {
          haptic("success");
        } else if (
          icon === "⚠️" ||
          icon === "⛔" ||
          (msg && /ошибка|не удалось/i.test(msg))
        ) {
          haptic("warning");
        }
      }
      return rawToast.apply(this, arguments);
    };
  }

  function initTgEnvironment() {
    ensureTgEnvironment();
    updateMainButton();

    const obsTarget = document.getElementById("cartPanel") || document.body;
    if (obsTarget && typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(() => updateMainButton());
      obs.observe(obsTarget, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTgEnvironment);
  } else {
    initTgEnvironment();
  }
})();

(function () {
  var NEED = [
    "haptic",
    "success",
    "notify",
    "sync",
    "updateMainButton",
    "syncMainButton",
    "closeTop",
    "isTg",
  ];
  function noop() {}
  function ensure() {
    window.TgUx = window.TgUx || {};
    NEED.forEach(function (k) {
      if (typeof window.TgUx[k] !== "function") window.TgUx[k] = noop;
    });
  }
  ensure();
  document.addEventListener("DOMContentLoaded", ensure);
  window.addEventListener("load", ensure);
})();
`;
fs.writeFileSync(path.join(root, 'public/app/core/overlay-core.js'), overlayCoreContent, 'utf8');
log('Перезаписан: public/app/core/overlay-core.js');

// ─────────────────────────────────────────────────────────────────────────────
// 2. public/app/core/ptr.js: убираем непассивный touchmove
// ─────────────────────────────────────────────────────────────────────────────
updateFile('public/app/core/ptr.js', (content) => {
  return content.replace(
    "document.addEventListener('touchmove', onTouchMove, { passive: false });",
    "document.addEventListener('touchmove', onTouchMove, { passive: true });"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. public/app/core/swipe.js: кэш ширины и фикс подсказки свайпа
// ─────────────────────────────────────────────────────────────────────────────
updateFile('public/app/core/swipe.js', (content) => {
  let c = content;
  c = c.replace(
    "p.addEventListener('touchstart',function(e){",
    "var cachedW = 0;\np.addEventListener('touchstart',function(e){\ncachedW = p.offsetWidth || innerWidth;"
  );
  c = c.replace("var w=W();if(dx>w)dx=w;", "var w=cachedW||W();if(dx>w)dx=w;");
  c = c.replace("var w=W();\nvar shouldClose", "var w=cachedW||W();\nvar shouldClose");
  c = c.replace("← свайп закроет профиль", "→ свайп вправо закроет профиль");
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. public/app/core/views.js: оптимизация findPush и вызов центрирования
// ─────────────────────────────────────────────────────────────────────────────
updateFile('public/app/core/views.js', (content) => {
  let c = content;
  // Убираем document.querySelectorAll('body *')
  const badLoopRegex = /function findPush\(\)\s*\{[\s\S]*?return null;\s*\}/;
  const goodFindPush = `function findPush() {
    return document.getElementById('pushHint') ||
      document.getElementById('pushBubble') ||
      document.querySelector('.pushHint, .push-bubble, .pushBubble');
  }`;
  c = c.replace(badLoopRegex, goodFindPush);

  // Вызываем alignRailWithCard и alignMbonusWithRail после обновления видов
  if (!c.includes('alignRailWithCard()')) {
    c = c.replace(
      'window.syncBrandViews = sv;',
      `window.syncBrandViews = function() {
        sv();
        if (typeof window.alignRailWithCard === 'function') window.alignRailWithCard();
      };`
    );
  }
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. public/app/ui/scrolltop.js: рейл на одном уровне с первой карточкой меню и бонусом
// ─────────────────────────────────────────────────────────────────────────────
updateFile('public/app/ui/scrolltop.js', (content) => {
  const newAlignCode = `/* public/app/ui/scrolltop.js — синхронизация положения рейла и бонусов */
function alignRailWithCard() {
  if (window.innerWidth > 1180) {
    var rAll = document.querySelectorAll('.wrap .rail, .wrap #deliveryRail');
    rAll.forEach(function (r) { r.style.marginTop = ''; });
    return;
  }
  var rail = document.querySelector('.wrap .rail:not([style*="display: none"]), .wrap #deliveryRail:not([style*="display: none"])');
  if (!rail || !rail.parentElement) return;

  var card = document.querySelector('#deliveryGrid .card, #grid .card, #deliveryView .card, #menuView .card');
  if (!card) return;

  rail.style.marginTop = '0px';
  var cardTop = card.getBoundingClientRect().top;
  var railTop = rail.getBoundingClientRect().top;
  var diff = Math.max(0, Math.round(cardTop - railTop));
  rail.style.marginTop = diff + 'px';

  if (typeof alignMbonusWithRail === 'function') alignMbonusWithRail();
}

function alignMbonusWithRail() {
  if (window.innerWidth > 1180) return;
  var mb = document.getElementById('mbonusBtn');
  var railBtn = document.querySelector('.wrap .rail button, .wrap #deliveryRail button');
  if (!mb || !railBtn) return;
  var rRect = railBtn.getBoundingClientRect();
  if (rRect.width > 0) {
    mb.style.left = Math.round(rRect.left) + 'px';
    mb.style.width = Math.round(rRect.width) + 'px';
    mb.style.minWidth = Math.round(rRect.width) + 'px';
    mb.style.maxWidth = Math.round(rRect.width) + 'px';
    mb.style.margin = '0';
  }
}

window.alignRailWithCard = alignRailWithCard;
window.alignMbonusWithRail = alignMbonusWithRail;
`;

  // Заменяем верхнюю функцию alignRailWithCard
  return content.replace(
    /\/\* public\/app\/ui\/scrolltop\.js[\s\S]*?window\.alignRailWithCard = alignRailWithCard;/,
    newAlignCode
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. public/app/delivery.js & cart.js: часовой пояс Калининграда для предзаказов
// ─────────────────────────────────────────────────────────────────────────────
const klgHourHelper = `
function getKaliningradHour() {
  try {
    var str = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Kaliningrad',
      hour: 'numeric',
      hour12: false
    }).format(new Date());
    return parseInt(str, 10);
  } catch (e) {
    var now = new Date();
    return (now.getUTCHours() + 2) % 24;
  }
}
function isDeliveryServiceOpen() {
  var h = getKaliningradHour();
  return h >= 11 && h < 22;
}
`;

updateFile('public/app/delivery.js', (content) => {
  let c = content;
  if (!c.includes('getKaliningradHour')) {
    c = klgHourHelper + '\n' + c;
  }
  // Заменяем проверку assertServiceOpen / preorderMode на расчет по Калининграду
  c = c.replace(/function assertServiceOpen\(\)\s*\{[\s\S]*?\}/, `function assertServiceOpen() { return isDeliveryServiceOpen(); }`);
  c = c.replace(/function preorderMode\(\)\s*\{[\s\S]*?\}/, `function preorderMode() {
    var h = getKaliningradHour();
    if (h >= 11 && h < 22) return null;
    return (h < 11) ? 'morning' : 'tomorrow';
  }`);
  return c;
});

updateFile('public/app/cart.js', (content) => {
  let c = content;
  if (!c.includes('getKaliningradHour')) {
    c = klgHourHelper + '\n' + c;
  }
  // Корректируем показ плашки в корзине
  c = c.replace(
    /var isOffHours = typeof window\.preorderMode === 'function' && window\.preorderMode\(\) !== null;/,
    "var isOffHours = !isDeliveryServiceOpen();"
  );
  return c;
});

// Серверная валидация часов доставки в server/routes/orders.js
updateFile('server/routes/orders.js', (content) => {
  let c = content;
  if (!c.includes('getKlgHour')) {
    c = `function getKlgHour() {
  try {
    const str = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kaliningrad', hour: 'numeric', hour12: false }).format(new Date());
    return parseInt(str, 10);
  } catch (_) {
    return (new Date().getUTCHours() + 2) % 24;
  }
}
` + c;
  }
  c = c.replace(
    /const now = new Date\(\);\s*const h = now\.getHours\(\);/,
    "const h = getKlgHour();"
  );
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. server/routes/chat.js: контекст перед вызовом и диплинк на панель ответа
// ─────────────────────────────────────────────────────────────────────────────
updateFile('server/routes/chat.js', (content) => {
  let c = content;

  // Ищем место формирования сообщения оператору в Telegram
  const tgNotifyRegex = /const text\s*=\s*`🔔 <b>Вызов оператора[\s\S]*?`;/;
  if (tgNotifyRegex.test(c)) {
    c = c.replace(tgNotifyRegex, (matched) => {
      return `let prevMsgsText = '';
      try {
        const rows = db.prepare('SELECT sender, text FROM chat_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 3').all(threadId || key);
        if (rows && rows.length) {
          prevMsgsText = '\\n\\n💬 <b>Предыдущие сообщения:</b>\\n' + rows.reverse().map(m => '• ' + (m.sender === 'user' ? 'Гость' : 'Бот') + ': "' + m.text + '"').join('\\n');
        }
      } catch (_) {}
      ` + matched.replace('Время: ${', '${prevMsgsText}\\n\\n⏰ Время: ${');
    });
  }

  // Заменяем ссылку кнопки в Telegram на открытие staff_chat с ключом треда
  c = c.replace(/\?tab=chat/g, '?tab=staff_chat&key=${encodeURIComponent(key)}');
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. public/app/core/deeplink.js: обработка tab=staff_chat для прямого ответа
// ─────────────────────────────────────────────────────────────────────────────
updateFile('public/app/core/deeplink.js', (content) => {
  let c = content;
  const staffChatHandler = `
      if (tab === 'staff_chat') {
        const targetKey = QS.get('key');
        setTimeout(() => {
          if (typeof window.openStaffChat === 'function') {
            window.openStaffChat();
            if (targetKey && typeof window.openScDialog === 'function') {
              window.scKey = targetKey;
              setTimeout(window.openScDialog, 200);
            }
          }
        }, 300);
      }
  `;
  if (!c.includes("tab === 'staff_chat'")) {
    c = c.replace("if (tab === 'chat') {", staffChatHandler + "\n      if (tab === 'chat') {");
  }
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. public/sw.js: бамп STATIC_CACHE
// ─────────────────────────────────────────────────────────────────────────────
updateFile('public/sw.js', (content) => {
  return content.replace(/zerno-static-v(\d+)/, (_, v) => `zerno-static-v${Number(v) + 1}`);
});

console.log('\n\x1b[36mВсе фиксы успешно применены! Запустите тесты: npm run pretest && npm run check\x1b[0m');