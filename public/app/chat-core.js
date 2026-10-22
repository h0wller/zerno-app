/* public/app/chat-core.js — Ф3.11: ядро чата (chatKey, kbAnswer, mySend, hints).
Зависит от chat-state.js, cart.js, delivery.js, views.js. */
(function () {
  "use strict";

  var CS = window.chatState;

  function activeCtxNow() {
    // Если тема выбрана явно через диплинк ?support=choose — используем её
    var chosen = CS.getChosenSupportCtx && CS.getChosenSupportCtx();
    if (chosen === "delivery" || chosen === "coffee") return chosen;
    // Во всех остальных случаях контекст чата строго следует за текущим брендом витрины!
    if (typeof brand !== "undefined" && (brand === "delivery" || brand === "coffee")) {
      if (CS.getChatCtx() !== brand) CS.setChatCtx(brand);
      return brand;
    }
    var domBrand = document.documentElement.getAttribute("data-brand");
    if (domBrand === "delivery" || domBrand === "coffee") return domBrand;
    var c = CS.getChatCtx();
    return c === "delivery" ? "delivery" : "coffee";
  }

  /* ── chatKey: обёртка над базовой chatKey() из index.html ── */
  window.chatKey = (function (_ck) {
    return function () {
      return _ck() + (activeCtxNow() === "delivery" ? ":d" : ":c");
    };
  })(window.chatKey);

  /* ── fetch-патчи: /api/chat/send и /api/push/send ── */
  (function () {
    var origFetch = window.fetch;
    window.fetch = function (urlArg, optsArg) {
      var nextOpts = optsArg;
      if (nextOpts && typeof nextOpts.body === "string" && String(urlArg).includes("/api/chat/send")) {
        try {
          var payload = JSON.parse(nextOpts.body);
          payload.ctx = activeCtxNow();
          nextOpts = { ...nextOpts, body: JSON.stringify(payload) };
        } catch (_) {}
      }
      var pr = origFetch.call(this, urlArg, nextOpts);
      try {
        if (
          nextOpts &&
          nextOpts.method === "POST" &&
          String(urlArg).indexOf("/api/push/send") > -1
        ) {
          pr.then(function (r) {
            return r.clone().json();
          })
            .then(function (j) {
              setTimeout(function () {
                toast(
                  "Доставлено: " +
                    j.delivered +
                    " · Ошибок: " +
                    j.failed +
                    (j.errors && j.errors.length
                      ? " (" + j.errors.join(", ") + ")"
                      : ""),
                  "📬"
                );
              }, 300);
            })
            .catch(function () {});
        }
      } catch (e) {}
      return pr;
    };
  })();

  /* ── toast-патч: дедупликация пуш-уведомлений ── */
  (function () {
    var _t = window.toast;
    var last = 0;
    window.toast = function (msg, icon) {
      if (typeof msg === "string" && /Доставлено:/.test(msg)) {
        var n = Date.now();
        if (n - last < 1500) return;
        last = n;
      }
      return _t(msg, icon);
    };
  })();

  /* ── setBotName ── */
  window.setBotName = function () {
    var head =
      document.querySelector("#chatPanel .chatHead") ||
      document.getElementById("chatPanel");
    var name = CS.getSupportPending()
      ? "Ника · поддержка"
      : CS.getChatCtx() === "delivery"
        ? "Ника · 🍕 доставка"
        : "Ника · ☕ кофейня";
    if (head) {
      var nodes = head.querySelectorAll("div,span,b");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.children.length === 0 && /Ника/.test(el.textContent || "")) {
          el.textContent = name;
          break;
        }
      }
    }
    var b = document.getElementById("ctxSwitch");
    if (b) b.textContent = (CS.getChatCtx() === "delivery" ? "🍕" : "") + " ▾";
  };

  /* ── dinfoP: кэширование /api/delivery/info ── */
  function dinfoP() {
    if (window.__dinfo) return Promise.resolve(window.__dinfo);
    window.__dinfoP =
      window.__dinfoP ||
      fetch(API_BASE + "/api/delivery/info")
        .then(function (r) {
          return r.json();
        })
        .then(function (x) {
          window.__dinfo = x;
          return x;
        });
    return window.__dinfoP;
  }

  /* ── kbAnswer: база знаний ── */
  async function kbAnswer(q, ctx) {
    q = (q || "").toLowerCase();
    if (ctx === "delivery") {
      var d = null;
      try {
        d = await dinfoP();
      } catch (e) {}
      if (/зон|стоимость достав|сколько стоит достав/.test(q) && d)
        return (
          "Доставка: " +
          d.zones
            .map(function (z) {
              return z.places.join(", ") + " — " + z.fee + " ₽";
            })
            .join("; ") +
          ". Самовывоз — бесплатно и −10%."
        );
      if (/самовывоз/.test(q))
        return "Самовывоз: пгт Янтарный, ул. Советская, 38А — и скидка −10% на весь заказ.";
      if (/сколько ждать|время достав|когда привез|часы|до скольки/.test(q))
        return "Работаем ежедневно 11:00–22:00, доставка в среднем ~45 минут. При оформлении можно выбрать слот «ко времени».";
      if (/акци|подарок|пив|маргарит|бесплатн/.test(q) && d) {
        var s = [];
        if (d.weekPromo) s.push(d.weekPromo.text);
        if (d.pizzaMonth)
          s.push("2 пиццы 35 см → «" + d.pizzaMonth.name + "» в подарок");
        return s.length
          ? "Сейчас у нас: " + s.join("; ")
          : "Акции обновляются по пятницам — следите за баннером 🍕";
      }
      if (/оплат|карт|наличн/.test(q))
        return "Оплата при получении: наличными или картой. Предоплаты нет.";
      if (/где.*заказ|статус.*заказ|мой заказ/.test(q))
        return "Статус заказа виден в профиле → «Мои заказы». Если срочное — напишите «позвать сотрудника».";
      if (/промокод/.test(q))
        return "Промокод доставки вводится в корзине в поле «Промокод» — скидка применится сразу.";
      return null;
    }
    if (/где вы|адрес|до скольки|часы работы|во сколько/.test(q))
      return "Мы у моря: п. Янтарный, Советская ул., 70г. Ежедневно май–сен 8:00–21:00, окт–апр 8:00–20:00 🌊";
    if (/штамп|бонус|карта гостя|10-й|десят/.test(q))
      return "Каждый 10-й кофе — бесплатно: покажите кассиру QR из профиля, он начислит штамп. На 10-м штампе кофе в подарок 🎁";
    if (/промокод/.test(q))
      return "Промокод вводится в «Бонусах» → «Есть промокод?» — штампы или подарок начислятся сразу.";
    return null;
  }

  if (typeof botReply === "function") {
    var _br = botReply;
    botReply = async function (q) {
      var a = await kbAnswer(q, CS.getChatCtx() || "coffee");
      return a || _br(q);
    };
  }

  /* Кнопка «Позвать сотрудника» скрыта по умолчанию и появляется ТОЛЬКО:
     1) когда гость сам попросил в чате (сотрудник, позовите, оператор...)
     2) когда гость написал непонятный боту текст (fallback)
     После подтверждённого нажатия кнопка пропадает до следующего такого вызова. */
  var callAllowed = false;

  /* ── showHints ── */
  function showHints() {
    if (CS.getSupportPending()) return;
    var msgs = document.getElementById("chatMsgs");
    if (!msgs) return;
    var old = msgs.querySelector(".hintsWrap");
    if (old) old.remove();
    var bar = document.getElementById("chatHintsBar");
    if (!bar) {
      var inp = document.getElementById("chatInput");
      var foot = inp && (inp.closest(".chatFoot") || inp.parentElement);
      if (!foot) return;
      bar = document.createElement("div");
      bar.id = "chatHintsBar";
      foot.parentNode.insertBefore(bar, foot);
    }
    bar.innerHTML = "";
    var list = (CS.getChatCtx() === "delivery" ? CS.DHINTS : CS.CHINTS).slice();
    if (callAllowed && !(typeof staffIn !== "undefined" && staffIn)) {
      list.unshift(CS.CALL_HINT);
    }
    list.forEach(function (h) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chatHint";
      b.textContent = h;
      b.dataset.hint = h;
      bar.appendChild(b);
    });
    msgs.scrollTop = 1e6;
  }

  /* ── addMsg: обёртка ── */
  window.addMsg = (function (_am) {
    return function (who, text) {
      if (CS.getSupportPending() && who === "bot") return;
      var activeCtx =
        CS.getChatCtx() ||
        (typeof brand !== "undefined" && brand === "delivery" ? "delivery" : "coffee");
      if (who === "bot" && typeof text === "string") {
        if (activeCtx === "delivery" && /поддержка.*кофе/i.test(text))
          text = CS.GREET_D;
        if (activeCtx === "coffee" && /поддержка.*доставк|Пятница/i.test(text))
          text = CS.GREET_C;
      }
      var r = _am(who, text);
      if (who === "system" && !CS.getSupportPending()) setTimeout(showHints, 60);
      return r;
    };
  })(window.addMsg);

  async function sendToChatApi(textVal, humanFlag, ctxVal) {
    try {
      await fetch(API_BASE + "/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: window.chatKey(),
          text: textVal,
          human: humanFlag ? 1 : 0,
          ctx: ctxVal,
        }),
      });
    } catch (e) {
      console.log("chat send err", e);
    }
  }

  /* ── mySend ── */
  async function mySend(q, confirmedHumanCall) {
    var inp = document.getElementById("chatInput");
    if (inp) inp.value = "";
    var msgs = document.getElementById("chatMsgs");
    var hw = msgs && msgs.querySelector(".hintsWrap");
    if (hw) hw.remove();

    var curCtx = activeCtxNow();
    CS.setChatCtx(curCtx);

    if (confirmedHumanCall) {
      callAllowed = false;
      window.addMsg("me", q);
      await sendToChatApi(q, 1, curCtx);
      window.addMsg(
        "bot",
        curCtx === "delivery"
          ? "Зову диспетчера доставки 🍕 Он получит уведомление и ответит прямо сюда."
          : "Зову сотрудника кофейни ☕ Он получит уведомление и ответит сюда."
      );
      if (typeof window.updateStaffBadge === "function") window.updateStaffBadge();
      showHints();
      return;
    }

    window.addMsg("me", q);
    await sendToChatApi(q, 0, curCtx);

    // Случай 1: Гость явно попросил текстом позвать сотрудника/оператора/диспетчера
    var isExplicitRequest = /позов|позови|сотрудн|человек|менедж|оператор|диспетчер|живой/i.test(
      q
    );
    if (isExplicitRequest) {
      callAllowed = true;
      window.addMsg(
        "bot",
        "Хотите подключить к чату сотрудника? Нажмите кнопку «" +
          CS.CALL_HINT +
          "» ниже и подтвердите вызов 👇"
      );
      showHints();
      return;
    }

    // Ищем ответ в базе знаний
    var a = null;
    try {
      a = await kbAnswer(q, CS.getChatCtx() || "coffee");
    } catch (e) {}
    if (!a && typeof _br === "function") {
      try {
        a = await _br(q);
      } catch (e) {}
    }

    // Случай 2: Гость написал белиберду (ответа в базе знаний нет)
    var isFallback = !a || /передаю человеку|Приняла!/i.test(a);
    if (isFallback) {
      callAllowed = true;
      window.addMsg(
        "bot",
        "Хм, не уверена, что поняла 🤔 Хотите, позову сотрудника? Тапните «" +
          CS.CALL_HINT +
          "» ниже."
      );
      showHints();
      return;
    }

    // Обычный ответ из базы знаний — кнопка «Позвать сотрудника» не нужна
    callAllowed = false;
    window.addMsg("bot", a);
    showHints();
  }

  window.sendChat = function (text, human) {
    return mySend(text, human);
  };

  /* ── reloadChatThread ── */
  window.reloadChatThread = async function () {
    var msgs = document.getElementById("chatMsgs");
    if (!msgs) return;
    msgs.innerHTML = "";
    lastChatId = 0;
    historyLoaded = false;
    callAllowed = false;
    try {
      if (typeof loadHistory === "function") await loadHistory();
    } catch (e) {}
    if (!CS.getSupportPending() && !msgs.children.length)
      window.addMsg(
        "bot",
        CS.getChatCtx() === "delivery" ? CS.GREET_D : CS.GREET_C
      );
    showHints();
  };

  /* ── loadScList, updateStaffBadge ── */
  // Сколько гость ждёт сотрудника: «только что», «5 мин», «2 ч».
  function waitLabel(ts) {
    var t = Date.parse(ts);
    if (!t) return "";
    var m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return "только что";
    if (m < 60) return m + " мин";
    return Math.round(m / 60) + " ч";
  }

  window.loadScList = async function () {
    try {
      var closedMode = !!window.scClosedView;
      var r = await api("/chat/list" + (closedMode ? "?closed=1" : ""));
      var btnClosed = document.getElementById("scShowClosed");
      if (btnClosed) {
        btnClosed.textContent = closedMode ? "← Активные чаты" : "Показать закрытые";
      }
      var filterCtx = window.__staffChatFilter || null;
      var threads = (r.threads || []).filter(function (t) {
        var tCtx = t.ctx || (/:d$/.test(t.key || "") ? "delivery" : "coffee");
        if (filterCtx === "coffee") return tCtx === "coffee";
        if (filterCtx === "delivery") return tCtx === "delivery";
        return true;
      });
      var listEl = document.getElementById("scList");
      if (!listEl) return;
      listEl.innerHTML =
        threads
          .map(function (t) {
            var tCtx = t.ctx || (/:d$/.test(t.key || "") ? "delivery" : "coffee");
            var shortId = String(t.key || "").replace(/:[cd]$/, "").slice(-4);
            var waiting = t.human && !closedMode && t.callTs;
            return (
              '<div class="hmini" style="cursor:pointer;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)" data-sck="' +
              esc(t.key) +
              '">' +
              '<div><b>' +
              esc(t.name) +
              '</b> <span style="opacity:.55;font-size:12px">#' +
              esc(shortId) +
              "</span> " +
              (tCtx === "delivery" ? "🍕" : "☕") +
              (t.human && !closedMode
                ? '<span class="tag hit" style="position:static;margin-left:6px">нужен ответ</span>'
                : "") +
              '<span style="float:right">' +
              (t.unread ? "новое: " + t.unread : "") +
              "</span></div>" +
              (t.lastGuest
                ? '<div style="opacity:.8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">💬 «' +
                  esc(t.lastGuest) +
                  "»</div>"
                : "") +
              (waiting
                ? '<div style="opacity:.6;font-size:12px;margin-top:2px">ждёт ' + esc(waitLabel(t.callTs)) + "</div>"
                : "") +
              "</div>"
            );
          })
          .join("") ||
        '<div class="hmini">' +
          (closedMode ? "Закрытых чатов нет" : "Пока тихо") +
          "</div>";
    } catch (e) {
      console.error("[chat] loadScList error:", e);
    }
  };

  window.updateStaffBadge = async function () {
    if (!me || !["admin", "cashier", "dispatch"].includes(me.role)) return;
    try {
      var r = await api("/chat/list");
      var list = r.threads || [];
      var cntCoffee = 0;
      var cntDelivery = 0;
      list.forEach(function (t) {
        var isDel = (t.ctx || (/:d$/.test(t.key || "") ? "delivery" : "coffee")) === "delivery";
        var weight = (+t.unread || 0) > 0 ? (+t.unread) : (t.human ? 1 : 0);
        if (isDel) cntDelivery += weight;
        else cntCoffee += weight;
      });
      var cntAll = cntCoffee + cntDelivery;
      var c1 = document.getElementById("chatsToggle"),
        c2 = document.getElementById("chatsToggle2"),
        c3 = document.getElementById("chatsToggleD");
      if (c1) c1.textContent = cntCoffee ? "💬 Чаты гостей · " + cntCoffee : "💬 Чаты гостей";
      if (c2) c2.textContent = cntAll ? "💬 Чаты гостей · " + cntAll : "💬 Чаты гостей";
      if (c3) c3.textContent = cntDelivery ? "💬 Чаты гостей · " + cntDelivery : "💬 Чаты гостей";
    } catch (e) {}
  };

  /* клики по подсказкам + двухшаговое подтверждение вызова сотрудника */
  document.addEventListener(
    "click",
    function (e) {
      var h = e.target.closest(".chatHint");
      if (!h) return;
      if (window.__hintDragUntil && Date.now() < window.__hintDragUntil) return;
      e.stopPropagation();
      e.preventDefault();
      var isCall =
        (h.dataset.hint || "").indexOf("Позвать") > -1 ||
        h.dataset.hint === CS.CALL_HINT;
      if (isCall || h.dataset.arm === "1") {
        if (h.dataset.arm === "1") {
          // 2-е нажатие (подтверждение): отправляем вызов и скрываем кнопку до следующего раза!
          h.dataset.arm = "";
          h.classList.remove("armed");
          callAllowed = false;
          h.remove();
          mySend(CS.CALL_HINT, true);
        } else {
          // 1-е нажатие: показываем предупреждение
          h.dataset.arm = "1";
          h.classList.add("armed");
          var bar2 = h.parentElement;
          if (bar2 && bar2.firstChild !== h) bar2.insertBefore(h, bar2.firstChild);
          h.textContent = "✅ Точно позвать? Нажмите ещё раз";
          setTimeout(function () {
            if (h.dataset.arm === "1") {
              h.dataset.arm = "";
              h.classList.remove("armed");
              h.textContent = CS.CALL_HINT;
            }
          }, 4000);
        }
        return;
      }
      mySend(h.dataset.hint || h.textContent, false);
    },
    true
  );

  /* синхронизация контекста при смене бренда в шапке */
  var topBrandSeg = document.getElementById("brandSeg");
  if (topBrandSeg) {
    topBrandSeg.addEventListener("click", function () {
      setTimeout(function () {
        if (typeof brand !== "undefined" && CS.getChatCtx() !== brand) {
          CS.setChatCtx(brand);
          callAllowed = false;
          window.setBotName();
          window.reloadChatThread();
        }
      }, 60);
    });
  }

  /* открытие чата: контекст следует за брендом, если не ждём выбор темы */
  (function () {
    var f = document.getElementById("chatFab");
    if (!f || f.__fvWrap) return;
    var old = f.onclick;
    f.__fvWrap = 1;
    f.onclick = async function (e) {
      if (typeof old === "function") {
        try {
          await old.call(this, e);
        } catch (err) {}
      }
      var p = document.getElementById("chatPanel");
      if (!p || !p.classList.contains("open")) return;
      if (CS.getSupportPending()) {
        window.setBotName();
        window.showSupportOverlay();
        return;
      }
      if (CS.getChatCtx() !== brand) {
        CS.setChatCtx(brand);
      }
      window.setBotName();
      if (!document.querySelector("#chatMsgs .hintsWrap")) showHints();
    };
  })();

  /* ── Ф3.12: оверлей выбора темы поддержки ── */
  function showSupportOverlay() {
    if (document.getElementById("supportChooseOverlay")) return;
    var d = document.createElement("div");
    d.id = "supportChooseOverlay";
    d.innerHTML =
      '<div class="scTitle">У вас вопрос по кофе или доставке?</div>' +
      '<div class="scSub">Выберите тему — откроется нужная Ника, а вызов сотрудника уйдёт правильной команде.</div>' +
      '<div class="ctxPick scBtns">' +
      '<button type="button" class="cpD" data-support-topic="delivery">🍕<br>Доставка<br><small>Пятница</small></button>' +
      '<button type="button" class="cpC" data-support-topic="coffee">☕<br>Кофейня<br><small>…и кофе</small></button></div>';
    document.body.appendChild(d);
    window.setBotName();
  }
  function hideSupportOverlay() {
    var o = document.getElementById("supportChooseOverlay");
    if (o) o.remove();
  }
  window.showSupportOverlay = showSupportOverlay;
  window.hideSupportOverlay = hideSupportOverlay;

  var QS12 = new URLSearchParams(location.search);
  var SUPPORT_ENTRY12 =
    QS12.get("tab") === "chat" || QS12.get("support") === "choose";
  if (SUPPORT_ENTRY12 && !CS.getChosenSupportCtx()) {
    document.body.classList.add("support-pending");
    var supTries = 0;
    var supIv = setInterval(function () {
      try {
        supTries++;
        var am = document.getElementById("authModal");
        if (am && am.classList.contains("show")) {
          am.classList.remove("show");
          try {
            window.syncOverlay();
          } catch (e) {}
        }
        var p = document.getElementById("chatPanel");
        if (p && !p.classList.contains("open")) {
          var f = document.getElementById("chatFab");
          if (f) f.click();
        } else if (p && p.classList.contains("open")) {
          showSupportOverlay();
        }
      } finally {
        if (
          CS.getChosenSupportCtx() ||
          document.getElementById("supportChooseOverlay") ||
          supTries > 40
        )
          clearInterval(supIv);
      }
    }, 250);
  }
  document.addEventListener(
    "click",
    function (e) {
      var b = e.target.closest("[data-support-topic]");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      var ctx =
        b.getAttribute("data-support-topic") === "delivery"
          ? "delivery"
          : "coffee";
      CS.setChosenSupportCtx(ctx);
      CS.setSupportPending(false);
      document.body.classList.remove("support-pending");
      CS.setChatCtx(ctx);
      hideSupportOverlay();
      window.setBotName();
      setTimeout(window.setBotName, 50);
      setTimeout(window.setBotName, 300);
      setTimeout(window.setBotName, 900);
      var cp = document.getElementById("chatPanel");
      if (cp) cp.classList.add("open");
      var fb2 = document.getElementById("chatFab");
      if (fb2) fb2.classList.add("open");
      if (typeof window.syncOverlay === "function") window.syncOverlay();
      if (window.ztBus) {
        window.ztBus.emit("ui:update-scrolltop");
      } else if (typeof window.updateScrollTop === "function") {
        window.updateScrollTop();
      }
      window.reloadChatThread();
    },
    true
  );
})();

/* ── Ф5.1c: drag-скролл бара подсказок мышью (зажал и потянул) ── */
(function () {
  var bar = null,
    down = false,
    sx = 0,
    sl = 0,
    moved = 0;
  document.addEventListener("pointerdown", function (e) {
    bar = (e.target.closest && e.target.closest("#chatHintsBar")) || null;
    if (!bar || e.pointerType !== "mouse") return;
    down = true;
    moved = 0;
    sx = e.clientX;
    sl = bar.scrollLeft;
  });
  document.addEventListener("pointermove", function (e) {
    if (!down || !bar) return;
    var dx = e.clientX - sx;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 8) {
      bar.scrollLeft = sl - dx;
      if (e.cancelable) e.preventDefault();
    }
  });
  function end() {
    if (down && bar && moved > 8) window.__hintDragUntil = Date.now() + 80;
    down = false;
    bar = null;
  }
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
})();