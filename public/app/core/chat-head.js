/* public/app/core/chat-head.js — Ф3.10a: стабильные классы шапки чата.
   Растворено из fix-views.js (v51). Изолированный IIFE, зависимостей от window нет. */
(function () {
  'use strict';
  function norm() {
    var p = document.getElementById('chatPanel');
    if (!p) return;
    var head = p.querySelector('.chatHead');
    if (!head) {
      var kids = p.children;
      for (var i = 0; i < kids.length; i++) {
        if (/Ника/.test(kids[i].textContent || '')) { head = kids[i]; break; }
      }
      if (head) head.classList.add('chatHead');
    }
    if (head && !head.querySelector('.chName')) {
      var nodes = head.querySelectorAll('div,span,b');
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].children.length === 0 && /Ника/.test(nodes[j].textContent || '')) {
          nodes[j].classList.add('chName');
          break;
        }
      }
    }
  }
  norm();
  setTimeout(norm, 300);
  setTimeout(norm, 1200);
  setTimeout(norm, 3000);
  document.addEventListener('click', function () { setTimeout(norm, 60); }, true);
  var p0 = document.getElementById('chatPanel');
  if (p0 && window.MutationObserver) new MutationObserver(function () { norm(); }).observe(p0, { childList: true, subtree: true });
})();