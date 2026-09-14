/* ВРЕМЕННЫЙ debug. УДАЛИТЬ после отладки. */
setTimeout(function () {
  var m = document.getElementById('staffChatModal');
  if (!m) return console.log('[DBG3] нет #staffChatModal');

  var origAdd = m.classList.add.bind(m.classList);
  var origRemove = m.classList.remove.bind(m.classList);

  m.classList.add = function () {
    var r = origAdd.apply(this, arguments);
    console.log('[DBG3] classList.add(', Array.from(arguments).join(','), ') → modal.class:', m.className);
    return r;
  };
  m.classList.remove = function () {
    var r = origRemove.apply(this, arguments);
    console.log('[DBG3] classList.remove(', Array.from(arguments).join(','), ') → modal.class:', m.className);
    return r;
  };

  console.log('[DBG3] start, class:', m.className);
  window.openStaffChat();
  console.log('[DBG3] after openStaffChat, class:', m.className);
}, 1500);