/* public/app/admin-extra.js — Ф3.20: админ-кластер — промо-лист, guard'ы кофейного меню,
брендовый хром (тикер/логотип), согласие с политикой при регистрации.
Было fix-views.js: остаток секции 4 + R5 + R6. */
(function(){
'use strict';
/* ── список промокодов (модалка админа) ── */
window.loadPromos=async function(){try{var r=await api('/promos');
  document.getElementById('pmList').innerHTML=r.promos.map(function(p){
    var exp=p.expires?new Date(p.expires).toLocaleDateString('ru-RU'):'бессрочно';
    var dead=p.expires&&new Date(p.expires)<new Date();
    var kind=p.kind==='stamp'?'+'+p.value+' штамп(а) 🌊':p.kind==='free'?'+'+p.value+' кофе 🌊':p.kind==='percent'?'−'+p.value+'% 🍕':'−'+p.value+' ₽ 🍕';
    return '<div class="logrow" style="align-items:center;gap:8px;flex-wrap:wrap">'+
      '<span class="lt">'+esc(p.code)+'</span>'+
      '<span style="flex:1;min-width:150px">'+kind+' · '+(dead?'истёк':'до '+exp)+' · лимит '+(p.maxuses||'∞')+' · исп. '+p.uses+'</span>'+
      '<button class="btn ghost" data-pt="'+p.id+'">'+(p.active?'Выкл':'Вкл')+'</button>'+
      '<button class="btn ghost danger" data-pd="'+p.id+'">🗑</button></div>';}).join('')
  ||'<div class="hmini">Пока пусто — создайте первый код</div>';}catch(e){}};
/* ── guard'ы: не рисуем кофейное меню, пока MENU не загружен ── */
if(typeof renderMenu==='function'){renderMenu=(function(_rm){return function(){
  if(typeof MENU==='undefined'||!Array.isArray(MENU))return;
  return _rm.apply(this,arguments);};})(renderMenu);}
if(typeof renderRail==='function'){renderRail=(function(_rr){return function(){
  if(typeof MENU==='undefined'||!Array.isArray(MENU))return;
  return _rr.apply(this,arguments);};})(renderRail);}
if(typeof loadMenu==='function'){loadMenu=(function(_lm){return async function(){
  var r=await _lm.apply(this,arguments);
  try{if(brand==='coffee'){renderRail();renderMenu();}}catch(e){}
  return r;};})(loadMenu);}
/* ── R5: тикер и логотип по бренду.
   Ф3.25: ЕДИНСТВЕННЫЙ владелец mark.innerHTML — applyBrandChrome();
   views.js только синхронизирует класс .is-delivery и вызывает эту функцию. ── */
function applyBrandChrome(){
var deliv=(brand==='delivery');
var track=document.getElementById('tickerTrack');
if(track){
var L=deliv?['Пятница — доставка пиццы и роллов','Ежедневно 11:00–22:00','Доставка ~45 мин','vk.ru/fridaypizza39','Каждые 2000 ₽ в чеке — 0,5 пива в подарок']
:['кофейня на берегу моря …и кофе','каждый 10-й кофе — бесплатно','п. Янтарный, Советская 70г','t.me/and_coffee39','ежедневно с 8:00–21:00'];
track.innerHTML=L.concat(L).map(function(x){return '<span>'+x+'</span>';}).join('');
}
/* Ф3.24: меняем только src внутри марки — #brandTitle/#brandSub не трогаем,
    их тексты обновляет sv() из views.js. Один владелец на элемент. */
var mark=document.getElementById('brandMark')||document.querySelector('.topbar .brand .mark');
if(mark){
mark.innerHTML='<img class="brandLogo" src="'+(deliv?'friday-logo.svg':'andCoffee.svg')+'" alt="'+(deliv?'Пятница':'…и кофе')+'" onerror="this.outerHTML=\'<span style=&quot;font-size:26px&quot;>'+(deliv?'🍕':'☕')+'</span>\'">';
}
}
window.applyBrandChrome=applyBrandChrome;
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyBrandChrome,60);});
/* ── R6: согласие с политикой при регистрации ── */
(function(){
  var form=document.getElementById('regForm');if(!form||document.getElementById('consentRow'))return;
  var lab=document.createElement('label');lab.id='consentRow';lab.className='chk';
  lab.innerHTML='<input type="checkbox" id="consentBox"><span>Согласен с <a href="/privacy.html" target="_blank" style="color:#1F4E8C">политикой конфиденциальности</a> и обработкой персональных данных</span>';
  var btn=document.getElementById('regBtn');if(btn)form.insertBefore(lab,btn);
})();
document.addEventListener('click',function(e){
  var b=e.target.closest('#regBtn');if(!b)return;
  var cb=document.getElementById('consentBox');
  if(cb&&!cb.checked){e.stopImmediatePropagation();e.preventDefault();toast('Отметь согласие с политикой конфиденциальности','⚠️');}
},true);
(function(){var _f=window.fetch;window.fetch=function(u,o){ /* слой consent поверх fetch-патчей */
  try{
    if(o&&o.body&&typeof o.body==='string'&&String(u).indexOf('/api/auth/register')>-1){
      var b=JSON.parse(o.body);var cb=document.getElementById('consentBox');b.consent=(cb&&cb.checked)?1:0;
      o=Object.assign({},o,{body:JSON.stringify(b)});
    }
  }catch(e){}
  return _f.call(this,u,o);};})();
})();
/* ── Ф3.23: инициализация брендового хрома (было хвостом fix-views v61) ── */
if(typeof window.applyBrandChrome==='function')window.applyBrandChrome();
setTimeout(function(){if(typeof window.applyBrandChrome==='function')window.applyBrandChrome();},400);