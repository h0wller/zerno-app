/* ВРЕМЕННЫЙ debug-модуль. УДАЛИТЬ после отладки. */
(function () {
  function inspect(label) {
    var t1 = document.getElementById('chatsToggle');
    var t2 = document.getElementById('chatsToggle2');
    var t3 = document.getElementById('chatsToggleD');
    var m  = document.getElementById('staffChatModal');
    console.log('[DBG2 ' + label + ']',
      't1.onclick === window.openStaffChat:', !!(t1 && t1.onclick === window.openStaffChat),
      '| t2.onclick === window.openStaffChat:', !!(t2 && t2.onclick === window.openStaffChat),
      '| t3:', t3 ? 'есть' : 'НЕТ',
      '| typeof window.openStaffChat:', typeof window.openStaffChat,
      '| modal.class:', m && m.className
    );
  }

  setTimeout(function () {
    inspect('after-1.5s');

    var m = document.getElementById('staffChatModal');

    // 1. Прямой вызов window.openStaffChat
    console.log('[DBG2] вызов window.openStaffChat() напрямую');
    try {
      window.openStaffChat();
      console.log('[DBG2] OK, modal.class:', m && m.className);
    } catch (e) {
      console.log('[DBG2] ОШИБКА:', e && e.message, '| stack:', e && e.stack);
    }
    if (m) m.classList.remove('show');

    // 2. Прямой вызов через onclick кнопки
    var t1 = document.getElementById('chatsToggle');
    if (t1 && typeof t1.onclick === 'function') {
      console.log('[DBG2] вызов t1.onclick() напрямую');
      try {
        t1.onclick.call(t1, { target: t1, preventDefault: function () {} });
        console.log('[DBG2] OK, modal.class:', m && m.className);
      } catch (e) {
        console.log('[DBG2] ОШИБКА:', e && e.message, '| stack:', e && e.stack);
      }
    }
  }, 1500);
})();