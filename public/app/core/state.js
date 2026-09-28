/* public/app/core/state.js — Ф5.1: глобальное состояние приложения.
Было inline-скрипт index.html (блок глобалов). Ф5.6-финал: module с window-экспортами. */

/* Приватные константы (ключи localStorage) */
const T_USER='zt_user',T_ONB='zt_onb';

/* Разделяемое состояние → window-свойства (все модули читают голыми идентификаторами) */
window.USER_TOKEN=localStorage.getItem(T_USER)||null;
window.onboarded=localStorage.getItem(T_ONB)==='1';
window.MENU=[];
window.meta={updatedAt:Date.now()};
window.me=null;
window.mode='guest';
window.editMode=false;
window.brand=localStorage.getItem('zt_brand')||'coffee';

/* Константы категорий → window-свойства (используются в menu.js, delivery.js, views.js) */
window.CATS=[{id:'coffee',e:'☕',l:'Кофе',t:'#F3E2CE'},{id:'drinks',e:'🧋',l:'Напитки',t:'#E4EFE2'},
 {id:'seasonal',e:'🌊',l:'Сезонное',t:'#DCE9F5'},{id:'food',e:'🥐',l:'Еда',t:'#F9ECC7'},
 {id:'desserts',e:'🍰',l:'Десерты',t:'#F8E1E4'},{id:'shop',e:'🛍',l:'С полки',t:'#E8E6E1'}];
window.TINT=Object.fromEntries(window.CATS.map(c=>[c.id,c.t]));

// [tg-mini-app-detect]
// Детект Telegram Mini App. Выполняется ДО deeplink.js, который срезает query-строку.
window.__isTgMiniApp = (function () {
  try {
    if (new URLSearchParams(location.search).get("src") === "tg") return true;
    if (/tgWebAppData=/.test(location.hash)) return true;
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) return true;
  } catch (e) {}
  return false;
})();

/* ── Ф5.6.1: iOS gesture-guard (было INLINE #2 index.html, дословно) ── */
// Блокировка паразитного зума окна в iOS Safari / PWA (защита от вылета WebKit)
      document.addEventListener(
        "gesturestart",
        function (e) {
          e.preventDefault();
        },
        { passive: false },
      );

      document.addEventListener(
        "gesturechange",
        function (e) {
          e.preventDefault();
        },
        { passive: false },
      );

      document.addEventListener(
        "gestureend",
        function (e) {
          e.preventDefault();
        },
        { passive: false },
      );
