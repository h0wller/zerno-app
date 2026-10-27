/* Ф3.4: перенесено из fix-views.js (настройки + шестерёнка) */

/* 1. Создание модалки */
(function(){
  if(document.getElementById('settingsModal'))return;
  var m=document.createElement('div');m.className='modal';m.id='settingsModal';
  m.innerHTML='<div class="modal-card" style="width:min(420px,100%)"><button class="mclose" id="setClose">✕</button>'+
  '<h3>Настройки</h3><div class="msub">PIN, уведомления и данные устройства</div>'+
  '<div class="set-row"><span style="flex:1">🔐 Задать / сменить PIN</span><button class="btn ghost" id="setPinGo2">Открыть</button></div>'+
  '<div class="set-row" style="margin-bottom:6px"><span style="flex:1">🔔 Каналы уведомлений</span></div>'+
  '<div style="display:flex;gap:16px;margin:0 0 12px 4px">'+
  '<label class="chk"><input type="checkbox" id="ntTg2"> 🤖 Telegram</label>'+
  '<label class="chk"><input type="checkbox" id="ntWeb2"> 🔔 Пуши браузера</label></div>'+
  '<div class="set-row"><span style="flex:1">↺ Сбросить локальные данные</span><button class="btn ghost danger" id="resetGo2">Сброс</button></div></div>';
  document.body.appendChild(m);
  
  document.getElementById('setClose').onclick=function(){m.classList.remove('show');syncOverlay();};
  document.getElementById('setPinGo2').onclick=function(){m.classList.remove('show');syncOverlay();var b=document.getElementById('setPinBtn');if(b)b.click();};
  document.getElementById('resetGo2').onclick=function(){var b=document.getElementById('resetBtn');if(b)b.click();};
  
  var t=document.getElementById('ntTg2'),w=document.getElementById('ntWeb2');
  function sync(){syncNotifyAll();}
  [t,w].forEach(function(el){el.addEventListener('change',function(){window.applyNotify(t.checked,w.checked);});});
  window.__syncSettings=sync;
})();

/* 2. Шестерёнка (десктоп) */
(function(){
  var ph=document.querySelector('#profileBox .phead');
  if(ph&&!ph.querySelector('.gear')){
    var g=document.createElement('button');g.className='gear';g.textContent='⚙️';g.title='Настройки';
    g.onclick=function(){if(window.__syncSettings)window.__syncSettings();
    document.getElementById('settingsModal').classList.add('show');syncOverlay();};
    ph.appendChild(g);
  }
  var spb=document.getElementById('setPinBtn');if(spb)spb.style.display='none';
  var nd=document.getElementById('notifyDetails');if(nd)nd.style.display='none';
})();

/* 3. Тап по подложке закрывает «Настройки» */
(function(){
  var ov=document.getElementById('overlay');
  if(ov){
    ov.addEventListener('click',function(){
      var m=document.getElementById('settingsModal');
      if(m&&m.classList.contains('show'))m.classList.remove('show');
    });
  }
})();

/* 4. Мобильная адаптация (из v64) */
(function(){
  var $=function(s){return document.querySelector(s);};
  function openSettings(){
    var m=$('#settingsModal');if(!m)return;
    m.classList.add('show');
    var ov=$('#overlay');if(ov){ov.classList.add('show');ov.classList.add('ov-high');}
    if(window.__syncSettings)window.__syncSettings();
  }
  function afterClose(){
    var ov=$('#overlay');if(!ov)return;
    var anyModal=document.querySelector('.modal.show');
    var panelOpen=$('#panel').classList.contains('open');
    if(!anyModal&&!panelOpen){ov.classList.remove('show');ov.classList.remove('ov-high');}
    else if(anyModal){ov.classList.add('show');ov.classList.add('ov-high');}
    else{ov.classList.add('show');ov.classList.remove('ov-high');}
  }
  var pb=$('#profileBox');if(!pb)return;
  var ph=pb.querySelector('.phead');
  if(ph&&!ph.querySelector('.gear')){
    var g=document.createElement('button');g.type='button';g.className='gear';g.textContent='⚙️';
    g.style.cssText+=';margin-left:auto;width:40px;height:40px;border-radius:12px;border:1.5px solid var(--line);background:#fff;font-size:18px;flex:0 0 auto';
    ph.appendChild(g);
  }
  var gear=ph&&ph.querySelector('.gear');
  if(gear)gear.onclick=openSettings;
  var sc=$('#setClose');if(sc)sc.addEventListener('click',function(){setTimeout(afterClose,0);});
  document.addEventListener('click',function(e){
    var m=$('#settingsModal');if(!m||!m.classList.contains('show'))return;
    if(e.target.id==='overlay'){e.stopPropagation();m.classList.remove('show');afterClose();}
  },true);
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var m=$('#settingsModal');if(m&&m.classList.contains('show')){m.classList.remove('show');afterClose();}
  },true);
})();