(function(){
  var QS=new URLSearchParams(location.search);
  if(QS.get('debug')==='1')localStorage.setItem('zdebug','1');
  if(QS.get('debug')==='0')localStorage.removeItem('zdebug');
  var on=localStorage.getItem('zdebug')==='1';
  var box=null;
  function show(line){
    if(!on)return;
    if(!box){box=document.createElement('div');
      box.style.cssText='position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;background:#111;color:#0f0;font:11px/1.4 monospace;z-index:99999;padding:6px;white-space:pre-wrap';
      document.documentElement.appendChild(box);}
    box.textContent+=line+'\n';box.scrollTop=box.scrollHeight;
  }
  function report(kind,msg){
    var line='['+kind+'] '+msg;
    show(line);
    try{fetch('/api/clientlog',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind:kind,msg:String(msg).slice(0,500)})});}catch(e){}
  }
  window.addEventListener('error',function(e){report('ERR',e.message+' @ '+(e.filename||'').split('/').pop()+':'+e.lineno);});
  window.addEventListener('unhandledrejection',function(e){report('REJ',(e.reason&&(e.reason.message||e.reason))||'promise rejected');});
  var oe=console.error;console.error=function(){report('CONSOLE',Array.prototype.join.call(arguments,' '));oe.apply(console,arguments);};
})();