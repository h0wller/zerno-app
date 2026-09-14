/* Ф3.4: перенесено из fix-views.js (закрытие карточки гостя) */
(function(){
  var acts=document.querySelector('#custCard .acts');
  if(!acts||document.getElementById('custClose'))return;
  var b=document.createElement('button');b.id='custClose';b.className='btn ghost';b.textContent='✕ Закрыть карточку';
  b.onclick=function(){document.getElementById('custCard').classList.remove('show');try{found=null;}catch(e){}};
  acts.appendChild(b);
})();