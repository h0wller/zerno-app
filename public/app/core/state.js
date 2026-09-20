/* public/app/core/state.js — Ф5.1: глобальное состояние приложения.
Было inline-скрипт index.html (блок глобалов). Классик-скрипт: всё в window. */
const T_USER='zt_user',T_ONB='zt_onb';
var USER_TOKEN=localStorage.getItem(T_USER)||null;
var onboarded=localStorage.getItem(T_ONB)==='1';
var MENU=[];
var meta={updatedAt:Date.now()};
var me=null;
var mode='guest';
var editMode=false;
var brand=localStorage.getItem('zt_brand')||'coffee';
const CATS=[{id:'coffee',e:'☕',l:'Кофе',t:'#F3E2CE'},{id:'drinks',e:'🧋',l:'Напитки',t:'#E4EFE2'},
 {id:'seasonal',e:'🌊',l:'Сезонное',t:'#DCE9F5'},{id:'food',e:'🥐',l:'Еда',t:'#F9ECC7'},
 {id:'desserts',e:'🍰',l:'Десерты',t:'#F8E1E4'},{id:'shop',e:'🛍',l:'С полки',t:'#E8E6E1'}];
const TINT=Object.fromEntries(CATS.map(c=>[c.id,c.t]));