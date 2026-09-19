/* public/app/profile-brand.js — Ф3.16: брендовые правила профиля + verifyNote + fridayInfo.
Было fix-views.js: секция 6 + R4 + v64. Единственная обёртка renderProfile. */
(function(){
'use strict';
/* ── fridayInfo: инжект инфо-блока (было R4) ── */
(function(){
  var pb=document.getElementById('profileBox');if(!pb||document.getElementById('fridayInfo'))return;
  var d=document.createElement('div');d.id='fridayInfo';
  d.innerHTML='<b>Пятница — доставка пиццы и роллов</b>п. Янтарный, ул. Советская, 38А (самовывоз)<br>Ежедневно 11:00–22:00 · доставка ~45 мин<br>🌐 <a href="https://vk.ru/fridaypizza39" target="_blank" style="color:#1F4E8C;font-weight:800">vk.ru/fridaypizza39</a><br>⭐ <a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/" target="_blank" style="color:#1F4E8C;font-weight:800">отзывы на Яндекс Картах</a><br><a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/?add-review=true" target="_blank" class="btn fire" style="margin-top:10px;display:inline-block">⭐ Оставить отзыв</a>';
  var hist=Array.prototype.slice.call(pb.querySelectorAll('h4')).filter(function(h){return /История/.test(h.textContent);})[0];
  if(hist)pb.insertBefore(d,hist);else pb.appendChild(d);
})();
/* ── брендовые правила: слияние v64 profileBrandRules + R4 applyProfileBrand ── */
function histH4(){
  return Array.prototype.slice.call(document.querySelectorAll('#profileBox h4')).filter(function(h){return /История/i.test(h.textContent);})[0]||null;
}
function brandRules(){
  var deliv=(typeof brand!=='undefined'&&brand==='delivery');
  var mo=document.getElementById('myOrders'),mb=document.getElementById('myOrdersBtn'),fi=document.getElementById('fridayInfo');
  if(mo)mo.style.display=deliv?'':'none';
  if(mb)mb.style.display=deliv?'':'none';
  Array.prototype.slice.call(document.querySelectorAll('#profileBox .placebox')).forEach(function(p){
    var t=p.textContent||'';
    if(/Мы у моря/i.test(t))p.style.display=deliv?'none':'';
    if(/Понравилось у нас/i.test(t))p.style.display=deliv?'none':'';
  });
  Array.prototype.slice.call(document.querySelectorAll('#profileBox a')).forEach(function(a){
    if(/instagram\.com|t\.me\/and_coffee39/i.test(a.href||''))a.style.display=deliv?'none':'';
  });
  if(fi){
    fi.style.display=deliv?'':'none';
    if(deliv){var h=histH4();if(h&&fi!==h.previousSibling)h.parentNode.insertBefore(fi,h);}
  }
  if(typeof window.syncNotifyUI==='function')window.syncNotifyUI();
}
window.applyProfileBrand = brandRules;

// Корректный обработчик клика по переключателю бренда с обновлением атрибутов темы
var bSegEl = document.getElementById('brandSeg');
if (bSegEl) {
  bSegEl.addEventListener('click', function() {
    setTimeout(function() {
      var isDeliv = (typeof brand !== 'undefined' && brand === 'delivery');
      var modeName = isDeliv ? 'delivery' : 'coffee';
      
      // Синхронизируем корни документов, чтобы стили фонов переключались мгновенно
      document.documentElement.setAttribute('data-brand', modeName);
      document.body.setAttribute('data-brand', modeName);
      
      brandRules();
    }, 50);
  });
}

var brQueued=false;
new MutationObserver(function(){
  if(brQueued)return;brQueued=true;
  requestAnimationFrame(function(){brQueued=false;brandRules();});
}).observe(document.getElementById('myOrders')||document.body,{childList:true,subtree:true});
setTimeout(brandRules,300);
/* ── relink + verifyNote (было секция 6) ── */
function relink(){document.querySelectorAll('a[href*="t.me/and_coffee_bot"]').forEach(function(a){a.href='https://t.me/'+(window.TG_USERNAME||'and_coffee_bot');});}
window.renderVerifyNote=function(){
  var host=document.getElementById('bonusBox');
  if(!host) return;

  var n=document.getElementById('verifyNote');
  if(!n){n=document.createElement('div');n.id='verifyNote';host.insertBefore(n,host.firstChild);}

  // Скрываем весь блок, если нет юзера или бренд «доставка»
  var deliv = (typeof brand!=='undefined' && brand==='delivery');
  if(!me || deliv){ n.hidden=true; n.innerHTML=''; return; }

  // Кто ты?
  var isStaff    = !!(me.role && me.role !== 'guest');       // admin / cashier / dispatch
  var isVerified = (me.verified === true || me.verified === 1 || me.verified > 0);

  // Какие секции показывать
  var showInfo       = true;                                  // «Как устроены бонусы» — всегда
  var showActivation = !isStaff && !isVerified;               // форма активации — гостям
  var showTgBonus    = !isStaff && !me.welcome && !me.tg;     // +1 штамп TG — не-сотрудникам

  var html = '';

  // ── Секция 1: справка (всегда для авторизованного) ──
  if(showInfo){
    html += '<small style="color:#5B6B7A;background:#EDF2F6;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">Как устроены бонусы:<br>🫘 штампы — кассир начисляет по вашему QR<br>🎁 +1 штамп — привязка Telegram<br>🧾 активация профиля — код из 4 цифр на кассе</small>';
  }

  // ── Секция 2: активация кодом (только гость без верификации) ──
  if(showActivation){
    html += '<small style="color:#8A4B2A;background:#FFF6F0;border:1.5px dashed #E4B49A;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">🧾 Кассир назовёт 4 цифры кода активации — введите их:</small>'
         +  '<div style="display:flex;gap:8px"><input id="actCode" inputmode="numeric" maxlength="4" placeholder="Код" style="flex:1"><button class="btn fire" id="actBtn">Активировать</button></div>';
  }

  // ── Секция 3: +1 штамп за Telegram (только не-сотрудникам) ──
  if(showTgBonus){
    html += '<small style="color:#163B6B;background:#EAF1F9;border:1.5px dashed #B9CDE4;border-radius:12px;padding:8px 12px;display:block;margin-top:8px">🎁 <b>+1 штамп</b> за привязку в <a href="https://t.me/and_coffee_bot" style="color:#1F4E8C;font-weight:800">Telegram</a>: откройте бота и нажмите «Поделиться номером»</small>';
  }

  n.hidden = false;
  n.innerHTML = html;
  relink();

  var ab = document.getElementById('actBtn');
  if(ab) ab.onclick = async function(){
    try{
      var r = await api('/auth/activate-guest',{method:'POST',body:{code:document.getElementById('actCode').value.trim()}});
      me = r.customer;
      toast('Профиль активирован! А +1 штамп ждёт в Telegram 🎁','');
      renderAll();
    }catch(e){ toast(e.message,'⚠️'); }
  };
};
/* ── единственная обёртка renderProfile ── */
renderProfile=(function(_rp){return function(){var r=_rp.apply(this,arguments);
  var deliv=(brand==='delivery');
  var q=document.getElementById('qrMain');var qb=q&&q.closest('.qrbox');
  if(qb)qb.style.display=deliv?'none':'';
  var st=document.querySelector('#profileBox .stats');
  if(st)st.style.display=deliv?'none':'';
  if(me)loadMyOrders();
  brandRules();
  return r;};})(renderProfile);
})();
