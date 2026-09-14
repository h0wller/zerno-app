/* ВРЕМЕННЫЙ debug. УДАЛИТЬ после отладки. */
setTimeout(function () {
  var m = document.getElementById('staffChatModal');

  // Тест 1: прямой classList.add работает?
  console.log('[DBG6] before:', m.className);
  m.classList.add('show');
  console.log('[DBG6] immediate:', m.className);

  setTimeout(function () {
    console.log('[DBG6] +300ms:', m.className);
    console.log('[DBG6] display:', getComputedStyle(m).display);

    // Тест 2: что внутри openStaffChat
    console.log('[DBG6] source head:', window.openStaffChat.toString().slice(0, 600));

    // Тест 3: длина fn
    console.log('[DBG6] fn length:', window.openStaffChat.toString().length);
  }, 300);
}, 1500);