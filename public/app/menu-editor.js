/* public/app/menu-editor.js — Ф3.6: редактор меню (openEditor, exitEdit, editorFields) */
(function(){
'use strict';

var DCATSL=[
  {id:'pizza',e:'🍕',l:'Пиццы'},
  {id:'rolls',e:'🍣',l:'Роллы'},
  {id:'sets',e:'🍱',l:'Сеты'},
  {id:'sauces',e:'🥫',l:'Соусы'}
];

function editorFields(){
  var isDeliv=(brand==='delivery');
  var isPizza=isDeliv&&edit&&edit.cat==='pizza';
  var pL=document.getElementById('emPrice').closest('label');
  var vL=document.getElementById('emVol').closest('label');
  var cL=document.getElementById('emCoffee').closest('label');
  if(pL)pL.style.display=isPizza?'none':'';
  if(vL)vL.style.display=isPizza?'none':'';
  if(cL)cL.style.display=isDeliv?'none':'';
  var ob=document.getElementById('emOptsBox');
  if(ob)ob.hidden=!isPizza;
}

function openEditor(id){
  if(mode!=='admin'||!me||me.role!=='admin')return;
  var pool=(brand==='delivery')?DMENU:MENU;
  var src=id?pool.find(function(x){return x.id===id;}):null;
  edit=src?clone(src):{
    cat:brand==='delivery'?'pizza':'coffee',
    e:brand==='delivery'?'🍕':'☕',
    name:'',desc:'',comp:[],vol:'',price:0,tag:'',coffee:0,
    on:1,img:null,
    section:brand==='delivery'?'delivery':'coffee',
    opts:[]
  };
  document.getElementById('emTitle').textContent=src?'Редактировать позицию':'Новая позиция';
  document.getElementById('emCat').innerHTML=(brand==='delivery'?DCATSL:CATS).map(function(c){
    return '<option value="'+c.id+'">'+c.e+' '+c.l+'</option>';
  }).join('');
  document.getElementById('emName').value=edit.name;
  document.getElementById('emCat').value=edit.cat;
  document.getElementById('emPrice').value=edit.price||'';
  document.getElementById('emVol').value=edit.vol||'';
  document.getElementById('emDesc').value=edit.desc||'';
  document.getElementById('emComp').value=(edit.comp||[]).join(', ');
  document.getElementById('emTag').value=edit.tag||'';
  document.getElementById('emEmoji').value=edit.e||'';
  document.getElementById('emCoffee').checked=!!edit.coffee;
  document.getElementById('emOn').checked=!!edit.on;
  document.getElementById('emDel').style.display=src?'':'none';
  document.getElementById('emDup').style.display=src?'':'none';
  var os=edit.opts||[];
  for(var i=0;i<4;i++){
    var w=document.getElementById('emOpt'+i+'w'),pp=document.getElementById('emOpt'+i+'p');
    if(w)w.value=os[i]?os[i].w.replace(' г',''):'';
    if(pp)pp.value=os[i]?os[i].p:'';
  }
  editorFields();
  renderZone();
  document.getElementById('emModal').classList.add('show');
  syncOverlay();
  setTimeout(function(){document.getElementById('emName').focus();},150);
}

function exitEdit(){
  if(!editMode)return;
  editMode=false;
  document.body.classList.remove('editing');
  var b=document.getElementById('editToggle');
  b.textContent='✏️ Редактировать';
  b.classList.remove('on');
  if(brand==='delivery')renderDeliveryMenu();
  else renderMenu();
}

// Экспорт глобалов
window.openEditor = openEditor;
window.exitEdit = exitEdit;

// Обработчики UI
document.getElementById('emCat').addEventListener('change',function(){
  if(edit)edit.cat=this.value;
  editorFields();
});

document.getElementById('emSave').onclick=async function(){
  edit.name=document.getElementById('emName').value.trim()||'Без названия';
  edit.vol=document.getElementById('emVol').value.trim();
  edit.desc=document.getElementById('emDesc').value.trim();
  edit.comp=document.getElementById('emComp').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  edit.tag=document.getElementById('emTag').value;
  edit.e=document.getElementById('emEmoji').value.trim()||(brand==='delivery'?'🍕':'☕');
  edit.coffee=document.getElementById('emCoffee').checked?1:0;
  edit.on=document.getElementById('emOn').checked?1:0;
  edit.cat=document.getElementById('emCat').value;

  if(brand==='delivery'){
    edit.section='delivery';
    if(edit.cat==='pizza'){
      var defs=[['25 см, пышное',25],['35 см, пышное',35],['25 см, тонкое',25],['35 см, тонкое',35]];
      edit.opts=defs.map(function(dd,i){
        var w=document.getElementById('emOpt'+i+'w').value.trim()||'0';
        var p=+document.getElementById('emOpt'+i+'p').value||0;
        return {l:dd[0],w:w+' г',p:p,sz:dd[1]};
      });
      edit.price='0';
    }else{
      edit.opts=[];
      edit.price=String(+document.getElementById('emPrice').value||0);
    }
    try{
      if(edit.id)await api('/menu/'+edit.id,{method:'PUT',body:edit});
      else await api('/menu',{method:'POST',body:edit});
      dcat=edit.cat;
      await loadDelivery();
      closeEditor();
      toast('«'+esc(edit.name)+'» сохранено · меню доставки обновлено','✅');
    }catch(err){toast(err.message,'⚠️');}
    return;
  }

  var priceRaw=document.getElementById('emPrice').value.trim();
  edit.price=priceRaw.includes('/')?priceRaw:String(Math.max(0,Math.round(Number(priceRaw)||0)));
  edit.section='coffee';
  try{
    if(edit.id)await api('/menu/'+edit.id,{method:'PUT',body:edit});
    else await api('/menu',{method:'POST',body:edit});
    cat=edit.cat;
    query='';
    document.getElementById('searchInput').value='';
    renderRail();
    await loadMenu();
    closeEditor();
    toast('«'+esc(edit.name)+'» сохранено · меню обновлено для гостей','✅');
  }catch(err){toast(err.message,'⚠️');}
};

document.getElementById('editToggle').onclick=function(){
  editMode=!editMode;
  document.body.classList.toggle('editing',editMode);
  var b=document.getElementById('editToggle');
  b.textContent=editMode?'✔ Готово':'✏️ Редактировать';
  b.classList.toggle('on',editMode);
  if(brand==='delivery')renderDeliveryMenu();
  else renderMenu();
  if(editMode)toast('Режим редактирования: ✏️ на карточке или тумблер «в меню»','✏️');
};

})();