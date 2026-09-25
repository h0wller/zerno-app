/* public/app/chat.js — F2.1: чат гостя (бот) + чаты гостей для стаффа */
/* State-переменные в top-level classic script → window.X.
   fix-views.js (v61) читает/пишет их напрямую — контракт сохраняем. */
var chatOpened = false, unread = 0;
var callTimer = null;
window.lastChatId = 0; window.historyLoaded = false; window.staffIn = false; /* Ф5.8c-1-fix: разделяемое состояние чата (chat-core пишет голыми, auth — через window) */
var CALL_LABEL = '🙋 Позвать сотрудника';
var scKey = null, scClosedView = false;

(function () {
  'use strict';

  /* ── гость ↔ бот ── */
  const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const unreadKey = () => 'zt_unread_' + chatKey();

  function addMsg(who, text) {
    const m = document.createElement('div');
    m.className = 'msg ' + who;
    const safe = esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--flame)">$1</a>');
    m.innerHTML = `${safe}<time>${now()}</time>`;
    $('#chatMsgs').append(m);
    $('#chatMsgs').scrollTop = 1e6;
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'typing'; t.id = 'tp'; t.innerHTML = '<i></i><i></i><i></i>';
    $('#chatMsgs').append(t);
    $('#chatMsgs').scrollTop = 1e6;
  }
  function hideTyping() { const t = $('#tp'); t && t.remove(); }

  function renderChips() {
    const list = ['Как работает 10-й кофе?', 'Где вы?', 'Какие чаи есть?', 'Моти — какие вкусы?'];
    if (me) list.push(CALL_LABEL);
    $('#chatChips').innerHTML = list.map(t => `<button>${t}</button>`).join('');
  }

  function botReply(q) {
    q = q.toLowerCase();
   if(/привет|здравств|добр/.test(q))return'Здравствуйте! 👋 Это Ника из «…и кофе». Подскажу по меню, бонусам и чаю.';
 if(/инст|insta/.test(q))return'Мы в Инстаграм! 📸 https://www.instagram.com/and_coffee39/ — подписывайтесь.';
 if(/10|десят|штамп|бонус|лояльн|бесплат|накоп/.test(q))return'Работает так: покупаете кофе — кассир сканирует ваш QR и ставит штамп-зерно 🫘 Собрали 9 — десятый кофе бесплатно! Подарок появится в «Бонусах» и будет ждать, пока вы его не выпьете 😄';
 if(/ча[йи]|чаев|ассам|эрл|сенча|улун|ройбуш|каркаде|трав/.test(q))return'У нас семь чаёв: ассам, эрл грей, сенча, молочный улун, горные травы, ройбуш с малиной и каркаде с цукатами. 400 мл — 210 ₽. Какой под настроение?';
 if(/моти/.test(q))return'Моти — 4 вкуса: клубника-пломбир, финик-дорблю, манго-пломбир и вишня-латте. 275 ₽ за штучку счастья.';
 if(/во сколько|до скольк|время работы|часы работы|график|режим работы|когда открыт|работаете/.test(q))return'Ежедневно: май–сентябрь 8:00–21:00, октябрь–апрель 8:00–20:00. Мы в Янтарном, Советская 70г 🌊';
 if(/адрес|где вы|найти вас|на карте/.test(q))return'Мы у моря: п. Янтарный, Советская ул., 70г. Белый домик с вывеской «…и кофе» 🌊';
 if(/телеграм|связ|написать|контакт/.test(q))return'Пишите в Telegram: '+SOCIAL_URL+' — отвечаем быстро и с удовольствием.';
 if(/молоко|овсян|кокос|миндал|альтернатив|банан/.test(q))return'Альтернативное молоко (овсяное, кокосовое, миндальное, банановое) — +70 ₽. Банановое, кстати, слаще обычного!';
 if(/состав|капучино|из чего|входит/.test(q)){
  const hit=MENU.find(p=>p.name.toLowerCase().includes('капучино'));
  return hit&&hit.comp&&hit.comp.length?`Состав: ${hit.comp.join(', ')}. Полный состав любой позиции виден прямо в меню 📋`
   :'Состав каждой позиции указан в карточке меню 📋'}
 if(/меню|новинк|сезон/.test(q))return'Загляните в категорию «🌊 Сезонное»: Монблан, кофейный лимонад, «Я не на диете» и тропическая матча-тоник. Всё по 400–420 ₽ и очень фотогеничное ✨';
 if(/возврат|вернуть/.test(q))return'Возврат оформим на кассе по чеку — мгновенно. Деньги вернутся на карту за 3–5 дней.';
 if(/спасибо|благодар/.test(q))return'Всегда рады! Приходите ещё — море рядом, кофе горячий 💙';
 if(/отзыв|рейтинг|оценить|яндекс/.test(q))return'Будем рады вашему отзыву! 🌟 Ссылка: '+REVIEW_URL+' — это правда помогает маленькой кофейне у моря.';
 if(/позов|сотруд|человек|менедж|оператор|живой/.test(q))return'Приняла! Зову сотрудника — обычно отвечаем за 2–3 минуты 🙋';
 return'Приняла! Передаю человеку — обычно отвечаем за 2–3 минуты. А пока могу рассказать про: чаи, моти, бонусы, адрес и часы работы.'
  }

  function chatKey() {
    if (me) return me.id;
    let k = localStorage.getItem('zt_chatkey');
    if (!k) { k = 'anon-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('zt_chatkey', k); }
    return k;
  }

function sendChat(text) {
  if (!text.trim()) return;
  addMsg('me', text);
  $('#chatInput').value = '';
  const key = chatKey();
  if (staffIn) {
    fetch(API_BASE + '/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, text, human: 0 }) }).catch(() => {});
    return;
  }
  const reply = botReply(text);
  const isFallback = reply.startsWith('Приняла!');
  const isExplicitHuman = /позов|сотруд|человек|менедж|оператор|живой/i.test(text);
  const human = isExplicitHuman && me ? 1 : 0;
  let out;
  if (isFallback && !isExplicitHuman) {
    out = 'Хм, не уверена, что поняла 🤔 Хотите, позову сотрудника? Тапните «💬 Позвать сотрудника» ниже.';
    } else if (isExplicitHuman && !me) {
    out = 'Передала бы вопрос сотруднику, но они отвечают только гостям с профилем 🙂 Создайте его за 10 секунд — тапните на аватарку сверху. А я подскажу по меню, бонусам и чаю!';
  } else {
    out = reply;
  }
  fetch(API_BASE + '/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, text, human }) }).catch(() => {});
  showTyping();
  setTimeout(() => {
    hideTyping();
    addMsg('bot', out);
    fetch(API_BASE + '/api/chat/botlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, text: out }) }).catch(() => {});
    if (!$('#chatPanel').classList.contains('open')) {
      unread++;
      const b = $('#chatBadge');
      b.hidden = false;
      b.textContent = unread;
    }
    if (isFallback && !isExplicitHuman) {
            const bar = document.getElementById('chatHintsBar');
      const call = bar && bar.querySelector('.chatHint[data-hint*="Позвать"]');
      if (call) {
        if (bar.firstChild !== call) bar.insertBefore(call, bar.firstChild);
        call.classList.add('armed', 'pulse');
              }
    }
  }, 700);
}

function showBadge() {
    const u = +localStorage.getItem(unreadKey()) || 0;
    const b = $('#chatBadge'); b.hidden = !u; b.textContent = u || '';
  }
  async function initChatPointer() {
    try {
      const r = await (
        await fetch(
          API_BASE +
            "/api/chat/thread?key=" +
            encodeURIComponent(chatKey()) +
            "&after=0",
        )
      ).json();
      for (const m of r.msgs) lastChatId = Math.max(lastChatId, m.id);
      const rk = "zt_read_" + chatKey();
      let readId = +localStorage.getItem(rk) || 0;
      if (!localStorage.getItem(rk)) {
        readId = lastChatId;
        localStorage.setItem(rk, String(readId));
      }
      localStorage.setItem(
        unreadKey(),
        r.msgs.filter((m) => m.who === "staff" && m.id > readId).length,
      );
      showBadge();
    } catch (e) {}
  }

  async function loadHistory() {
    try {
      const r = await (
        await fetch(
          API_BASE +
            "/api/chat/thread?key=" +
            encodeURIComponent(chatKey()) +
            "&after=0",
        )
      ).json();
      $("#chatMsgs").innerHTML = "";
      staffIn = false;
      for (const m of r.msgs) {
        lastChatId = Math.max(lastChatId, m.id);
        if (m.who === "guest") addMsg("me", m.text);
        else if (m.who === "staff") addMsg("staff", m.text);
        else if (m.who === "system") {
          staffIn = m.text.includes("подключился");
          addMsg("sys", m.text);
        } else addMsg("bot", m.text);
      }
      $("#chatFab").classList.toggle("live", staffIn);
      historyLoaded = true;
    } catch (e) {
      historyLoaded = true;
    }
  }
  /* ── стафф: чаты гостей ── */
function openStaffChat() {
  if (me && 'Notification' in window) {
    if (Notification.permission !== 'granted')
      toast('Включите уведомления в профиле — иначе не узнаете о вопросах гостей', '🔔');
    else
      navigator.serviceWorker.ready
        .then(r => r.pushManager.getSubscription())
        .then(s => {
          if (!s) toast('Включите уведомления в профиле (🔔), чтобы получать вопросы гостей', '🔔');
        });
  }
  $('#staffChatModal').classList.add('show');
  syncOverlay();
  $('#scDialogWrap').hidden = true;
  scKey = null;
  loadScList();
}
  function closeStaffChat() {
    $("#staffChatModal").classList.remove("show");
    (syncOverlay(), updateStaffBadge());
  }

  async function loadScList() {
    try {
      const r = await api("/chat/list" + (scClosedView ? "?closed=1" : ""));
      $("#scShowClosed").textContent = scClosedView
        ? "← Активные чаты"
        : "Показать закрытые";
      $("#scList").innerHTML =
        r.threads
          .map(
            (
              t,
            ) => `<div class="hmini" style="cursor:pointer" data-sck="${esc(t.key)}">
  <b>${esc(t.name)}</b>${t.human && !scClosedView ? '<span class="tag hit" style="position:static;margin-left:6px">нужен ответ</span>' : ""}
  <span style="float:right">${t.unread ? "новое: " + t.unread : ""}</span></div>`,
          )
          .join("") ||
        `<div class="hmini">${scClosedView ? "Закрытых чатов нет" : "Пока тихо"}</div>`;
    } catch (e) {}
  }
  async function openScDialog() {
    $("#scDialogWrap").hidden = false;
    $("#scCloseThread").textContent = scClosedView
      ? "↺ Открыть чат"
      : "✓ Закрыть чат";
    try {
      const r = await api("/chat/dialog?key=" + encodeURIComponent(scKey));
      $("#scDialog").innerHTML = r.msgs
        .map(
          (m) =>
            `<div class="msg ${m.who === "guest" ? "me" : m.who === "staff" ? "staff" : "bot"}" style="max-width:92%">${esc(m.text)}</div>`,
        )
        .join("");
      $("#scDialog").scrollTop = 1e6;
    } catch (e) {}
    updateStaffBadge();
  }
  async function scSend() {
    const t = $("#scInput").value.trim();
    if (!t || !scKey) return;
    try {
      await api("/chat/reply", {
        method: "POST",
        body: { key: scKey, text: t },
      });
      $("#scInput").value = "";
      openScDialog();
    } catch (e) {
      toast(e.message, "⚠️");
    }
  }

async function updateStaffBadge() {
  if (!me || window.__ztAuthDead || (me.role !== "admin" && me.role !== "cashier" && me.role !== "dispatch")) return;
    try {
      const r = await api("/chat/list");
      const un = r.threads.reduce((a, t) => a + (+t.unread || 0), 0);
      $("#chatsToggle").textContent = un
        ? `💬 Чаты гостей · ${un}`
        : "💬 Чаты гостей";
      $("#chatsToggle2").textContent = un ? `💬 ${un}` : "💬";
    } catch (e) {}
  }

  /* ── инициализация (то, что сейчас выполняется при парсинге inline) ── */
  renderChips();
  $('#chatChips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.armed === '1') {
      clearTimeout(callTimer); b.dataset.armed = ''; b.textContent = CALL_LABEL;
      return sendChat('🙋 Позовите, пожалуйста, сотрудника');
    }
    if (b.textContent === CALL_LABEL) {
      b.dataset.armed = '1'; b.textContent = '❗ Точно позвать? Нажмите ещё раз';
      callTimer = setTimeout(() => { b.dataset.armed = ''; b.textContent = CALL_LABEL; }, 4000);
      return;
    }
    sendChat(b.textContent);
  });
  $('#chatSend').onclick = () => sendChat($('#chatInput').value);
  $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat($('#chatInput').value); });
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const r = await (await fetch(API_BASE + '/api/chat/thread?key=' + encodeURIComponent(chatKey()) + '&after=' + lastChatId)).json();
      for (const m of r.msgs) {
        lastChatId = Math.max(lastChatId, m.id);
        if (m.who === 'staff') {
          addMsg('staff', m.text);
          if (!$('#chatPanel').classList.contains('open')) {
            localStorage.setItem(unreadKey(), (+localStorage.getItem(unreadKey()) || 0) + 1); showBadge();
          }
        }
        if (m.who === 'system') {
          staffIn = m.text.includes('подключился'); addMsg('sys', m.text);
          $('#chatFab').classList.toggle('live', staffIn);
        }
      }
    } catch (e) {}
  }, 7000);
  $('#chatFab').onclick = async () => {
    const p = $('#chatPanel'); p.classList.toggle('open');
    $('#chatFab').classList.toggle('open', p.classList.contains('open'));
    if (p.classList.contains('open')) {
      if (!lastChatId) { try { const r = await (await fetch(API_BASE + '/api/chat/thread?key=' + encodeURIComponent(chatKey()) + '&after=0')).json(); for (const m of r.msgs) lastChatId = Math.max(lastChatId, m.id); } catch (e) {} }
      localStorage.setItem(unreadKey(), '0'); showBadge(); localStorage.setItem('zt_read_' + chatKey(), lastChatId);
      if (!historyLoaded) await loadHistory();
      if (!chatOpened) {
        chatOpened = true;
        if (!$('#chatMsgs').children.length) setTimeout(() => addMsg('bot', 'Привет! Я Ника, поддержка «…и кофе» 🌊 Если я не смогу ответить — к чату подключится сотрудник.'), 350);
      }
    }
  };
  $('#chatClose').onclick = () => { $('#chatPanel').classList.remove('open'); $('#chatFab').classList.remove('open'); };

  /* ── стафф: подписки ── */
  $('#chatsToggle').onclick = openStaffChat;
  $('#chatsToggle2').onclick = openStaffChat;
  $('#scClose').onclick = closeStaffChat;
  $('#scShowClosed').onclick = () => { scClosedView = !scClosedView; loadScList(); };
  $('#scCloseThread').onclick = async () => {
    if (!scKey) return;
    try {
      if (scClosedView) { await api('/chat/open', { method: 'POST', body: { key: scKey } }); toast('Чат снова активен', '↺'); }
      else { await api('/chat/close', { method: 'POST', body: { key: scKey } }); toast('Чат закрыт', '✅'); }
      $('#scDialogWrap').hidden = true; scKey = null; loadScList();
    } catch (e) { toast(e.message, '⚠️'); }
  };
  $('#scList').addEventListener('click', e => { const el = e.target.closest('[data-sck]'); if (!el) return; scKey = el.dataset.sck; openScDialog(); });
  $('#scBack').onclick = () => { $('#scDialogWrap').hidden = true; scKey = null; loadScList(), updateStaffBadge(); };
  $('#scSend').onclick = scSend;
  $('#scInput').addEventListener('keydown', e => { if (e.key === 'Enter') scSend(); });
  setInterval(() => { if (document.visibilityState === 'visible') updateStaffBadge(); }, 10000);

  /* ── shim в window — контракт F1.3 ── */
  Object.assign(window, {
    addMsg, showTyping, hideTyping, renderChips, botReply, chatKey, sendChat,
    showBadge, initChatPointer, loadHistory,
    openStaffChat, closeStaffChat, loadScList, openScDialog, scSend, updateStaffBadge,
  });
})();