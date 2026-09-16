/* public/app/chat-core.js — Ф3.11: ядро чата (chatKey, kbAnswer, mySend, hints).
Зависит от chat-state.js, cart.js, delivery.js, fix-views.js. */
(function () {
  "use strict";

  var CS = window.chatState;

  /* ── chatKey: обёртка над базовой chatKey() из index.html ── */
  window.chatKey = (function (_ck) {
    return function () {
      return _ck() + (CS.getChatCtx() === "delivery" ? ":d" : ":c");
    };
  })(window.chatKey);

  /* ── fetch-патчи: /api/chat/send и /api/push/send ── */
  (function () {
    var _f = window.fetch;
    window.fetch = function (u, o) {
      try {
        if (
          o &&
          o.body &&
          typeof o.body === "string" &&
          String(u).indexOf("/api/chat/send") > -1
        ) {
          var b = JSON.parse(o.body);
          b.ctx = CS.getChatCtx() || "coffee";
          o = Object.assign({}, o, { body: JSON.stringify(b) });
        }
      } catch (e) {}
      var pr = _f.call(this, u, o);
      try {
        if (
          o &&
          o.method === "POST" &&
          String(u).indexOf("/api/push/send") > -1
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
                  "📬",
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
        return "Статус заказа виден в профиле → «Мои заказы». Если срочное — нажмите «💬 Позвать сотрудника».";
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

  /* ── showHints ── */
  function showHints(){
  if(CS.getSupportPending())return;
  var msgs=document.getElementById('chatMsgs');if(!msgs)return;
  var old=msgs.querySelector('.hintsWrap');if(old)old.remove();
  var bar=document.getElementById('chatHintsBar');
  if(!bar){
    var inp=document.getElementById('chatInput');
    var foot=inp&&(inp.closest('.chatFoot')||inp.parentElement);
    if(!foot)return;
    bar=document.createElement('div');bar.id='chatHintsBar';
    foot.parentNode.insertBefore(bar,foot);
  }
  bar.innerHTML='';
  var list=(CS.getChatCtx()==='delivery'?CS.DHINTS:CS.CHINTS).slice();
    if(!(typeof staffIn!=='undefined'&&staffIn))list.push(CS.CALL_HINT);
          list.forEach(function(h){
    var b=document.createElement('button');b.type='button';b.className='chatHint';b.textContent=h;b.dataset.hint=h;bar.appendChild(b);
  });
  msgs.scrollTop=1e6;
}

  /* ── addMsg: обёртка ── */
  window.addMsg = (function (_am) {
    return function (who, text) {
      if (CS.getSupportPending() && who === "bot") return;
      if (who === "bot" && typeof text === "string") {
        if (CS.getChatCtx() === "delivery" && /поддержка «…и кофе»/.test(text))
          text = CS.GREET_D;
        if (CS.getChatCtx() === "coffee" && /поддержка доставки/.test(text))
          text = CS.GREET_C;
      }
      var r = _am(who, text);
      if (who === "system" && !CS.getSupportPending())
        setTimeout(showHints, 60);
      return r;
    };
  })(window.addMsg);

  /* ── mySend ── */
  async function mySend(q) {
    var inp = document.getElementById("chatInput");
    if (inp) inp.value = "";
    var msgs = document.getElementById("chatMsgs");
    var hw = msgs && msgs.querySelector(".hintsWrap");
    if (hw) hw.remove();
    window.addMsg("me", q);
    var isHuman = /позвать/i.test(q);
    try {
      await fetch(API_BASE + "/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: window.chatKey(),
          text: q,
          human: isHuman ? 1 : 0,
          ctx: CS.getChatCtx() || "coffee",
        }),
      });
    } catch (e) {
      console.log("chat send err", e);
    }
    if (isHuman) {
      window.addMsg(
        "bot",
        CS.getChatCtx() === "delivery"
          ? "Зову диспетчера доставки 🍕 Он получит уведомление и ответит прямо сюда."
          : "Зову сотрудника кофейни ☕ Он получит уведомление и ответит сюда.",
      );
      return;
    }
    var a = null;
    try {
      a = await kbAnswer(q, CS.getChatCtx() || "coffee");
    } catch (e) {}
    if (!a && typeof _br === "function") {
      try {
        a = await _br(q);
      } catch (e) {}
    }
    var isFallback = !a || /передаю человеку|Приняла!/i.test(a);
    if (isFallback) {
      window.addMsg(
        "bot",
        "Хм, не уверена, что поняла 🤔 Хотите, позову сотрудника? Тапните «🙋 Позвать сотрудника» ниже.",
      );
      showHints();
      setTimeout(function () {
        var wrap = msgs && msgs.querySelector(".hintsWrap");
        if (!wrap) return;
        var call = wrap.querySelector('.chatHint[data-hint*="Позвать"]');
        if (call) {
          call.classList.add("pulse");
          setTimeout(function () {
            call.classList.remove("pulse");
          }, 12000);
        }
      }, 80);
      return;
    }
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
    try {
      if (typeof loadHistory === "function") await loadHistory();
    } catch (e) {}
    if (!CS.getSupportPending() && !msgs.children.length)
      window.addMsg(
        "bot",
        CS.getChatCtx() === "delivery" ? CS.GREET_D : CS.GREET_C,
      );
    showHints();
  };

  /* ── loadScList, updateStaffBadge ── */
  window.loadScList = async function () {
    try {
      var r = await api("/chat/list" + (scClosedView ? "?closed=1" : ""));
      document.getElementById("scShowClosed").textContent = scClosedView
        ? "← Активные чаты"
        : "Показать закрытые";
      document.getElementById("scList").innerHTML =
        r.threads
          .map(function (t) {
            return (
              '<div class="hmini" style="cursor:pointer" data-sck="' +
              esc(t.key) +
              '">' +
              "<b>" +
              esc(t.name) +
              "</b> " +
              (t.ctx === "delivery" ? "🍕" : "☕") +
              (t.human && !scClosedView
                ? '<span class="tag hit" style="position:static;margin-left:6px">нужен ответ</span>'
                : "") +
              '<span style="float:right">' +
              (t.unread ? "новое: " + t.unread : "") +
              "</span></div>"
            );
          })
          .join("") ||
        '<div class="hmini">' +
          (scClosedView ? "Закрытых чатов нет" : "Пока тихо") +
          "</div>";
    } catch (e) {}
  };

  window.updateStaffBadge = async function () {
    if (!me || !["admin", "cashier", "dispatch"].includes(me.role)) return;
    try {
      var r = await api("/chat/list");
      var un = r.threads.reduce(function (a, t) {
        return a + (+t.unread || 0);
      }, 0);
      var c1 = document.getElementById("chatsToggle"),
        c2 = document.getElementById("chatsToggle2"),
        c3 = document.getElementById("chatsToggleD");
      if (c1) c1.textContent = un ? "💬 Чаты гостей · " + un : "💬 Чаты гостей";
      if (c2) c2.textContent = un ? "💬 " + un : "💬";
      if (c3) c3.textContent = un ? "💬 Чаты гостей · " + un : "💬 Чаты гостей";
    } catch (e) {}
  };
    /* клики по подсказкам + вызов сотрудника в два тапа */
  document.addEventListener("click", function (e) {
    var h = e.target.closest(".chatHint");
    if (!h) return;
    if (window.__hintDragUntil && Date.now() < window.__hintDragUntil) return;
    e.stopPropagation();
    e.preventDefault();
    var isCall = (h.dataset.hint || "").indexOf("Позвать") > -1 || h.dataset.hint === CS.CALL_HINT;
    if (isCall || h.dataset.arm === "1") {
      if (h.dataset.arm === "1") {
        h.dataset.arm = "";
        h.classList.remove("armed");
        h.textContent = CS.CALL_HINT;
        mySend(CS.CALL_HINT);
      } else {
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
    mySend(h.dataset.hint || h.textContent);
  }, true);

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
  /* ── Ф3.12: оверлей выбора темы поддержки (было секция 10 fix-views) ── */
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
      window.reloadChatThread();
    },
    true,
  );
})();
/* ── Ф5.1c: drag-скролл бара подсказок мышью (зажал и потянул) ── */
(function(){
  var bar=null,down=false,sx=0,sl=0,moved=0;
  document.addEventListener('pointerdown',function(e){
    bar=(e.target.closest&&e.target.closest('#chatHintsBar'))||null;
    if(!bar||e.pointerType!=='mouse')return;
    down=true;moved=0;sx=e.clientX;sl=bar.scrollLeft;
  });
  document.addEventListener('pointermove',function(e){
    if(!down||!bar)return;
    var dx=e.clientX-sx;moved=Math.max(moved,Math.abs(dx));
    if(moved>8){bar.scrollLeft=sl-dx;if(e.cancelable)e.preventDefault();}
  });
  function end(){
    if(down&&bar&&moved>8)window.__hintDragUntil=Date.now()+80;
    down=false;bar=null;
  }
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',end);
})();