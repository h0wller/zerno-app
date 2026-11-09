/* public/app/profile-brand.js — Ф3.16: брендовые правила профиля + verifyNote + fridayInfo.
Было fix-views.js: секция 6 + R4 + v64. Единственная обёртка renderProfile. */
(function(){
'use strict';
/* ── fridayInfo: инжект инфо-блока (было R4) ── */
(function(){
  var pb=document.getElementById('profileBox');if(!pb||document.getElementById('fridayInfo'))return;
  var d=document.createElement('div');d.id='fridayInfo';
  d.innerHTML =
    '<details class="friday-info-details">' +
      '<summary><span>О заведении</span><span class="friday-info-chevron" aria-hidden="true">⌄</span></summary>' +
      '<div class="friday-info-body">' +
        '<p class="friday-info-address">п. Янтарный, ул. Советская, 38А · доставка из приложения</p>' +
        '<div class="friday-info-hours" aria-label="Время работы">' +
          '<div class="friday-info-hours-row"><b>Май–сентябрь:</b><span>пн–вс 11:00–22:00</span></div>' +
          '<div class="friday-info-hours-row"><b>Октябрь–апрель:</b><span>пн–чт 11:00–21:00<br>пт–вс 11:00–22:00</span></div>' +
        '</div>' +
        '<div class="friday-info-links" aria-label="Мы в интернете">' +
          '<a class="friday-info-link" href="https://vk.ru/fridaypizza39" target="_blank" rel="noopener noreferrer" aria-label="ВКонтакте">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect width="24" height="24" rx="7" fill="#0077FF"/><path fill="#fff" d="M5 7.5h2.6c.2 3.1 1.6 4.6 2.8 4.9V7.5h2.2v2.9c1.2-.1 2.4-1.4 2.8-2.9h2.2c-.2 1.7-1.4 3.1-2.5 3.7 1 .5 2.5 1.8 2.9 3.8h-2.6c-.5-1.5-1.6-2.5-2.8-2.7v2.7h-.4C8 15 5.3 12.1 5 7.5z"/></svg>' +
            '<span>ВКонтакте</span>' +
          '</a>' +
          '<a class="friday-info-link" href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/" target="_blank" rel="noopener noreferrer" aria-label="Яндекс Карты">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#FC3F1D" d="M12 1.5a8.5 8.5 0 0 0-8.5 8.5c0 6.1 8.5 12.5 8.5 12.5S20.5 16.1 20.5 10A8.5 8.5 0 0 0 12 1.5z"/><text x="12" y="15.1" fill="#fff" font-family="Arial,sans-serif" font-size="12" font-weight="700" text-anchor="middle">Я</text></svg>' +
            '<span>Яндекс Карты</span>' +
          '</a>' +
        '</div>' +
        '<a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/?add-review=true" target="_blank" rel="noopener noreferrer" class="friday-info-review" aria-label="Оставить отзыв на Яндекс Картах">' +
          '<span>Оставить отзыв</span>' +
        '</a>' +
      '</div>' +
    '</details>';
  var historySection=pb.querySelector('.profile-history-section');
  if(historySection)pb.insertBefore(d,historySection);else pb.appendChild(d);
})();
/* ── брендовые правила: слияние v64 profileBrandRules + R4 applyProfileBrand ── */
function brandRules(){
  var deliv=(typeof brand!=='undefined'&&brand==='delivery');
  var deliverySection=document.getElementById('profileOrdersSection');
  var coffeeSection=document.getElementById('profileCoffeeSection');
  var deliveryPrompt=document.getElementById('profileDeliveryPrompt');
  var coffeePrompt=document.getElementById('profileCoffeePrompt');
  var fi=document.getElementById('fridayInfo');
  if(deliverySection)deliverySection.hidden=!deliv;
  if(coffeeSection)coffeeSection.hidden=deliv;
  if(deliveryPrompt)deliveryPrompt.hidden=!deliv;
  if(coffeePrompt)coffeePrompt.hidden=deliv;
  Array.prototype.slice.call(document.querySelectorAll('#profileBox .coffee-venue-card, #profileBox .coffee-review-card')).forEach(function(card){
    card.style.display=deliv?'none':'';
  });
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
    if(deliv){
      var historySection=document.querySelector('#profileBox .profile-history-section');
      if(historySection&&fi.nextElementSibling!==historySection)historySection.parentNode.insertBefore(fi,historySection);
    }
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', brandRules, { once: true });
} else {
  brandRules();
}
setTimeout(brandRules, 300);
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
  var showTgBonus    = !isStaff && !me.welcome && !me.tg;     // приветствие за регистрацию — не-сотрудникам

  var html = '';

  // Инструкции собраны в один закрытый по умолчанию disclosure.
  if(showInfo){
    html += '<details class="profile-loyalty-help">' +
      '<summary><span>Как работают бонусы?</span><span class="profile-loyalty-help-chevron" aria-hidden="true">⌄</span></summary>' +
      '<div class="profile-loyalty-help-content">' +
        '<p>🫘 <b>Штампы.</b> После покупки кассир сканирует ваш QR и начисляет 1 штамп. 10 штампов — бесплатный кофе.</p>' +
        (showTgBonus
          ? '<p>🎁 <b>Приветственный бонус.</b> При регистрации доступны приветственный кофе и бесплатная первая доставка. Чтобы получить их, откройте <a href="https://t.me/and_coffee_bot">Telegram-бота</a> и нажмите «Поделиться номером».</p>'
          : '') +
        (showActivation
          ? '<p>🧾 <b>Активация профиля.</b> Введите четырёхзначный код, который назовёт кассир.</p>'
          : '') +
      '</div>' +
    '</details>';
  }

  // Поле активации остаётся видимым — пользователю не нужно открывать справку,
  // чтобы завершить обязательный шаг.
  if(showActivation){
    html += '<div class="profile-activation-row"><label class="profile-activation-label" for="actCode">Код активации</label><input id="actCode" inputmode="numeric" maxlength="4" placeholder="4 цифры" aria-label="Четырёхзначный код активации"><button class="btn fire" id="actBtn">Активировать</button></div>';
  }

  n.hidden = false;
  n.innerHTML = html;
  relink();

  var ab = document.getElementById('actBtn');
  if(ab) ab.onclick = async function(){
    try{
      var r = await api('/auth/activate-guest',{method:'POST',body:{code:document.getElementById('actCode').value.trim()}});
      me = r.customer;
      toast('Профиль активирован! Приветственный напиток и бесплатная доставка уже ваши 🎁','');
      renderAll();
    }catch(e){ toast(e.message,'⚠️'); }
  };
};
/* ── единственная обёртка renderProfile ── */
renderProfile=(function(_rp){return function(){var r=_rp.apply(this,arguments);
  var panel = document.getElementById('panel');
  var profileTab = document.getElementById('pvProfile');
  var profileVisible = panel && profileTab && !profileTab.hidden &&
    (window.innerWidth > 1180 || panel.classList.contains('open'));
  if(me && profileVisible && typeof window.loadMyOrders==='function')window.loadMyOrders();
  brandRules();
  return r;};})(renderProfile);
})();
