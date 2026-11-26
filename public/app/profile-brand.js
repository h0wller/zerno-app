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
function getRealTelegramMiniApp(){
  var webApp = window.Telegram && window.Telegram.WebApp;
  if(!webApp || webApp.isStub || window.__isTgMiniApp !== true) return null;
  return typeof webApp.initData === 'string' && webApp.initData.length > 0 ? webApp : null;
}

function brandRules(){
  var deliv=(typeof brand!=='undefined'&&brand==='delivery');
  var currentCustomer = window.me || (typeof me !== 'undefined' ? me : null);
  var currentRole = currentCustomer && currentCustomer.role || 'guest';
  var currentVerified = !!currentCustomer && (
    currentCustomer.verified === true ||
    currentCustomer.verified === 1 ||
    Number(currentCustomer.verified) > 0
  );
  var pendingGuest = !!currentCustomer && currentRole === 'guest' && !currentVerified;
  var deliverySection=document.getElementById('profileOrdersSection');
  var coffeeSection=document.getElementById('profileCoffeeSection');
  var deliveryPrompt=document.getElementById('profileDeliveryPrompt');
  var coffeePrompt=document.getElementById('profileCoffeePrompt');
  var fi=document.getElementById('fridayInfo');
  if(deliverySection)deliverySection.hidden=!deliv || pendingGuest;
  if(coffeeSection)coffeeSection.hidden=deliv || pendingGuest;
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
/* ── relink + verifyNote (было секция 6) ── */
function relink(){document.querySelectorAll('a[href*="t.me/and_coffee_bot"]').forEach(function(a){a.href='https://t.me/'+(window.TG_USERNAME||'and_coffee_bot');});}
window.renderVerifyNote=function(){
  var profile = document.getElementById('profileBox');
  if(!profile) return;

  var n = document.getElementById('verifyNote');
  if(!n){
    n = document.createElement('section');
    n.id = 'verifyNote';
    n.className = 'profile-brand-section profile-activation-status';
    n.setAttribute('aria-label', 'Статус профиля и программы кофейни');
    n.setAttribute('role', 'status');
    n.setAttribute('aria-live', 'polite');
    profile.insertBefore(n, profile.querySelector('#profileCoffeeSection, #profileOrdersSection') || null);
  }

  var customer = window.me || (typeof me !== 'undefined' ? me : null);
  var isStaff = !!(customer && customer.role && customer.role !== 'guest');
  var isVerified = !!customer && (
    customer.verified === true ||
    customer.verified === 1 ||
    Number(customer.verified) > 0
  );

  if(!customer || isStaff){
    n.hidden = true;
    n.innerHTML = '';
    return;
  }

  var isDelivery = window.brand === 'delivery';
  var existingActivationDetails = n.querySelector('.profile-activation-details');
  var activationDetailsWasOpen = !!(existingActivationDetails && existingActivationDetails.open);
  var existingCashierFields = n.querySelector('#cashierActivationFields');
  var cashierFieldsWereOpen = !!(existingCashierFields && !existingCashierFields.hidden);
  var previousActivationCode = (n.querySelector('#actCode') || {}).value || '';
  var freeCoffees = Math.max(0, Number(customer.free) || 0);
  var coffeeHelp = !isDelivery
    ? '<details class="profile-loyalty-help">' +
        '<summary><span>Как работают бонусы?</span><span class="profile-loyalty-help-chevron" aria-hidden="true">⌄</span></summary>' +
        '<div class="profile-loyalty-help-content">' +
          '<p>🫘 <b>Штампы.</b> После покупки кассир сканирует ваш QR и начисляет 1 штамп. 10 штампов — бесплатный кофе.</p>' +
          '<p>Новости кофейни и связь: <a href="https://t.me/' + (window.TG_USERNAME || 'and_coffee_bot') + '" target="_blank" rel="noopener noreferrer">Telegram</a>.</p>' +
          (isVerified
            ? (freeCoffees > 0
              ? '<p>🎁 <b>Ваши подарки.</b> На карте профиля уже есть ' + freeCoffees + ' ' + (freeCoffees === 1 ? 'бесплатный кофе.' : 'бесплатных кофе.') + '</p>'
              : '<p>🎁 <b>Подарки.</b> На карте сейчас нет доступного бесплатного кофе.</p>')
            : '<p>🎁 Преимущества карты станут доступны после подтверждения номера.</p>') +
        '</div>' +
      '</details>'
    : '';

  if(isDelivery && isVerified){
    n.hidden = true;
    n.innerHTML = '';
    return;
  }

  if(!isVerified){
    var activatedHint = isDelivery
      ? 'После активации станут доступны заказы.'
      : 'После активации станет доступна карта штампов.';
    n.hidden = false;
    n.innerHTML =
      '<div class="profile-activation-copy">' +
        '<h4>Профиль не активирован</h4>' +
        '<p>' + activatedHint + '</p>' +
      '</div>' +
      '<details class="profile-activation-details"' + (activationDetailsWasOpen ? ' open' : '') + '>' +
        '<summary><span>Инструкция по активации</span><span class="profile-activation-chevron" aria-hidden="true">⌄</span></summary>' +
        '<div class="profile-activation-details-content">' +
          '<p>Подтвердите свой номер одним из двух способов:</p>' +
          '<div class="profile-activation-actions">' +
            '<button class="btn fire" id="actTgBtn" type="button">Войти через Telegram</button>' +
            '<button class="btn ghost" id="showCashierCodeBtn" type="button" aria-controls="cashierActivationFields" aria-expanded="' + (cashierFieldsWereOpen ? 'true' : 'false') + '">' +
              (cashierFieldsWereOpen ? 'Скрыть поле кода' : 'Ввести код кассира') +
            '</button>' +
          '</div>' +
          '<div class="profile-activation-code" id="cashierActivationFields"' + (cashierFieldsWereOpen ? '' : ' hidden') + '>' +
            '<p>Получите 4-значный код у кассира и введите его здесь.</p>' +
            '<div class="profile-activation-row">' +
              '<label class="profile-activation-label" for="actCode">Код кассира</label>' +
              '<input id="actCode" inputmode="numeric" maxlength="4" placeholder="4 цифры" aria-label="Четырёхзначный код кассира" autocomplete="one-time-code">' +
              '<button class="btn fire" id="actBtn" type="button">Активировать</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</details>';
    var codeInput = document.getElementById('actCode');
    if(codeInput) codeInput.value = previousActivationCode;
  } else if(!isDelivery){
    // The coffee explanation remains available after activation; the stamp card
    // and its actual free count remain the source of reward status.
    n.hidden = false;
    n.innerHTML = coffeeHelp;
  } else {
    n.hidden = true;
    n.innerHTML = '';
    return;
  }

  relink();
  var telegramActivationButton = document.getElementById('actTgBtn');
  if(telegramActivationButton){
    telegramActivationButton.onclick = async function(){
      if(telegramActivationButton.disabled) return;
      telegramActivationButton.disabled = true;
      telegramActivationButton.setAttribute('aria-busy', 'true');
      telegramActivationButton.textContent = 'Открываем Telegram…';
      try{
        var returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set('tab', 'profile');
        returnUrl.searchParams.delete('auth_token');
        var returnTo = returnUrl.pathname + returnUrl.search + returnUrl.hash;
        var response = await api('/auth/tg-link/request', {
          method: 'POST',
          body: { returnTo: returnTo }
        });
        var telegramUrl = new URL(response && response.tgUrl || '');
        if(telegramUrl.protocol !== 'https:' || telegramUrl.hostname !== 't.me'){
          throw new Error('Сервер вернул некорректную ссылку Telegram');
        }
        var miniApp = getRealTelegramMiniApp();
        if(miniApp && typeof miniApp.openTelegramLink === 'function'){
          miniApp.openTelegramLink(telegramUrl.toString());
        }else{
          window.location.assign(telegramUrl.toString());
        }
      }catch(error){
        toast(error.message || 'Не удалось открыть Telegram. Попробуйте ещё раз.', '⚠️');
        telegramActivationButton.disabled = false;
        telegramActivationButton.removeAttribute('aria-busy');
        telegramActivationButton.textContent = 'Войти через Telegram';
      }
    };
  }

  var cashierToggleButton = document.getElementById('showCashierCodeBtn');
  if(cashierToggleButton){
    cashierToggleButton.onclick = function(){
      var fields = document.getElementById('cashierActivationFields');
      if(!fields) return;
      var open = fields.hidden;
      fields.hidden = !open;
      cashierToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      cashierToggleButton.textContent = open ? 'Скрыть поле кода' : 'Ввести код кассира';
      if(open){
        var codeField = document.getElementById('actCode');
        if(codeField) codeField.focus();
      }
    };
  }

  var ab = document.getElementById('actBtn');
  if(!ab) return;
  ab.onclick = async function(){
    if(ab.disabled) return;
    var input = document.getElementById('actCode');
    var code = input ? input.value.trim() : '';
    if(!/^\d{4}$/.test(code)){
      toast('Введите 4-значный код активации', '⚠️');
      if(input) input.focus();
      return;
    }

    ab.disabled = true;
    ab.setAttribute('aria-busy', 'true');
    ab.textContent = 'Проверяем код…';
    try{
      var r = await api('/auth/activate-guest',{method:'POST',body:{code:code}});
      if(!r || !r.customer || !(r.customer.verified === true || r.customer.verified === 1 || Number(r.customer.verified) > 0)){
        throw new Error('Сервер не подтвердил активацию. Обновите профиль и проверьте статус.');
      }
      if(typeof window.setUser === 'function') window.setUser(window.USER_TOKEN, r.customer);
      else window.me = r.customer;
      if(typeof window.__profileMeReady === 'function') window.__profileMeReady();
      if(typeof window.renderAll === 'function') window.renderAll();
      if(typeof window.renderVerifyNote === 'function') window.renderVerifyNote();

      if(!isDelivery){
        var activatedFreeCoffees = Math.max(0, Number(r.customer.free) || 0);
        var message = 'Профиль активирован. Карта штампов открыта: ';
        message += activatedFreeCoffees > 0
          ? 'на карте ' + activatedFreeCoffees + ' ' + (activatedFreeCoffees === 1 ? 'бесплатный кофе. ' : 'бесплатных кофе. ')
          : 'на карте сейчас нет доступного бесплатного кофе; за покупки начисляются штампы, 10 штампов дают 1 бесплатный кофе. ';
        message += 'Покажите QR на карте кассиру для начисления штампа или получения подарка.';
        toast(message, '☕');
        if(typeof window.openPanel === 'function') window.openPanel();
        return;
      }

      var freeDelivery = false;
      var deliveryStatusKnown = false;
      try{
        var deliveryResponse = await api('/me/free-delivery');
        freeDelivery = !!(deliveryResponse && typeof deliveryResponse.code === 'string' && deliveryResponse.code.trim());
        deliveryStatusKnown = true;
      }catch(_){
        deliveryStatusKnown = false;
      }

      if(typeof window.closePanel === 'function') window.closePanel();
      if(freeDelivery){
        toast('Профиль активирован. Бесплатная первая доставка доступна: персональный код применится автоматически в корзине, результат будет виден в строке доставки и итоговой сумме.', '🍕');
      }else if(deliveryStatusKnown){
        toast('Профиль активирован. Персональный код бесплатной первой доставки сейчас не назначен. Корзина не применит этот бонус.', '🍕');
      }else{
        toast('Профиль активирован. Статус бесплатной первой доставки пока не удалось проверить; корзина перепроверит его при открытии.', '🍕');
      }
    }catch(e){
      toast(e.message || 'Не удалось активировать профиль', '⚠️');
      ab.disabled = false;
      ab.removeAttribute('aria-busy');
      ab.textContent = 'Активировать';
    }
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
