(function(){
  var QS=new URLSearchParams(location.search);
  if(QS.get('debug')==='1')localStorage.setItem('zdebug','1');
  if(QS.get('debug')==='0')localStorage.removeItem('zdebug');
  if(localStorage.getItem('zdebug')!=='1')return;
  var box=document.createElement('div');
  box.style.cssText='position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;background:#111;color:#0f0;font:11px/1.4 monospace;z-index:99999;padding:6px;white-space:pre-wrap';
  document.documentElement.appendChild(box);
  function line(s){box.textContent+=s+'\n';box.scrollTop=box.scrollHeight;}
  line('🟢 debug ready '+location.pathname);
  window.addEventListener('error',function(e){line('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno);});
  window.addEventListener('unhandledrejection',function(e){line('REJ '+((e.reason&&e.reason.message)||e.reason));});
  ['log','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){line(k.toUpperCase()+' '+Array.prototype.map.call(arguments,function(a){try{return typeof a==='object'?JSON.stringify(a):String(a);}catch(e){return String(a);}}).join(' '));o.apply(console,arguments);};});
  var _f=window.fetch;window.fetch=function(u,o){var m=(o&&o.method)||'GET';var p=_f.apply(this,arguments);
    p.then(function(r){if(m!=='GET'||!r.ok)line(m+' '+String(u).replace(location.origin,'')+' -> '+r.status);}).catch(function(){line(m+' FAIL '+u);});return p;};
  document.addEventListener('change',function(e){var t=e.target.closest('[data-onoff]');
    if(t)line('change onoff='+t.getAttribute('data-onoff')+' checked='+t.checked+' inGrid='+!!t.closest('#deliveryGrid'));},true);
  document.addEventListener('click',function(e){var t=e.target.closest('#deliveryGrid .donoff, #deliveryGrid [data-onoff]');
    if(t)line('click toggle: '+(t.className||t.tagName));},true);
})();
