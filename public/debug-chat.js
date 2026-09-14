/* ВРЕМЕННЫЙ debug-модуль для диагностики чата. УДАЛИТЬ после отладки. */
setTimeout(function () {
  var t1 = document.getElementById('chatsToggle');
  var t2 = document.getElementById('chatsToggle2');
  var m  = document.getElementById('staffChatModal');
  var fab = document.getElementById('chatFab');
  console.log('[DBG-chat-1]',
    't1:', t1 ? 'есть' : 'НЕТ',
    '| t1.onclick:', typeof (t1 && t1.onclick),
    '| t2:', t2 ? 'есть' : 'НЕТ',
    '| t2.onclick:', typeof (t2 && t2.onclick),
    '| window.openStaffChat:', typeof window.openStaffChat,
    '| modal.class:', m && m.className,
    '| modal.hidden:', m && m.hidden,
    '| fab.onclick:', typeof (fab && fab.onclick)
  );

  if (t1) {
    var r = t1.getBoundingClientRect();
    var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    console.log('[DBG-chat-2] element at #chatsToggle center:',
      el && el.id, '|', el && el.className, '|', el && el.tagName);
  }

  if (t1) {
    var orig = t1.onclick;
    t1.addEventListener('click', function () {
      console.log('[DBG-chat-3] click detected on #chatsToggle, onclick был:', typeof orig);
      var mm = document.getElementById('staffChatModal');
      setTimeout(function () {
        console.log('[DBG-chat-4] after click, modal.class:', mm && mm.className);
      }, 200);
    }, true);
  }
}, 1500);