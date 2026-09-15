/* public/app/core/swipe.js — Ф3.17: свайп как на iOS для панели профиля.
Было fix-views.js: v68 (свайп) + v68 (touch-action). */
(function(){
'use strict';
var css=document.createElement('style');
css.textContent=
'@media(max-width:1180px){'+
'#panel.open.swipe-hint{animation:panelNudge 1.1s cubic-bezier(.3,1.4,.4,1) 1}'+
'@keyframes panelNudge{0%{transform:none}30%{transform:translateX(-18px)}60%{transform:translateX(6px)}100%{transform:none}}'+
'.swipeHintChip{position:fixed;left:10px;top:50%;z-index:330;background:rgba(16,20,24,.78);color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;pointer-events:none;animation:hintFade 1.6s forwards}'+
'@keyframes hintFade{0%{opacity:0;transform:translateY(-50%) translateX(-8px)}20%{opacity:1;transform:translateY(-50%)}80%{opacity:1;transform:translateY(-50%)}100%{opacity:0;transform:translateY(-50%) translateX(-8px)}}'+
'}';
document.head.appendChild(css);
var p=document.getElementById('panel');if(!p)return;
var ov=document.getElementById('overlay');
var W=function(){return p.getBoundingClientRect().width||innerWidth;};
var sx=0,sy=0,dx=0,dy=0,axis=null,tracking=false,active=false,lastX=0,lastT=0,vel=0;
function setT(x){p.style.setProperty('transform','translateX('+x+'px)','important');}
function setOv(op){if(ov){ov.style.transition='none';ov.style.opacity=String(op);}}
function cleanup(){p.style.removeProperty('transform');p.style.transition='';if(ov){ov.style.transition='';ov.style.opacity='';}}
p.addEventListener('touchstart',function(e){
if(window.innerWidth>1180||!p.classList.contains('open'))return;
if(e.touches.length!==1)return;
var t=e.touches[0];sx=t.clientX;sy=t.clientY;lastX=sx;lastT=Date.now();
dx=0;dy=0;axis=null;active=false;tracking=true;vel=0;
},{passive:true});
p.addEventListener('touchmove',function(e){
if(!tracking)return;
var t=e.touches[0];dx=t.clientX-sx;dy=t.clientY-sy;
if(!axis){
if(Math.abs(dx)<7&&Math.abs(dy)<7)return;
axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
if(axis==='y'){tracking=false;return;}   // вертикаль — не мешаем скроллу
active=true;p.style.transition='none';
}
if(!active)return;
if(dx<0)dx=0;
var w=W();if(dx>w)dx=w;
setT(dx);
setOv(1-dx/w);                          // подложка гаснет за пальцем
var now=Date.now(),dt=now-lastT;
if(dt>0)vel=0.8*vel+0.2*((t.clientX-lastX)/dt);
lastX=t.clientX;lastT=now;
if(e.cancelable)e.preventDefault();
},{passive:false});
p.addEventListener('touchend',function(){
if(!tracking)return;
tracking=false;
if(!active)return;
active=false;
var w=W();
var shouldClose=dx>Math.min(120,w*0.35)||vel>0.5;   // длина ИЛИ резкость
p.style.transition='transform .32s cubic-bezier(.2,1,.3,1)';
if(ov)ov.style.transition='opacity .32s';
if(shouldClose){
setT(w+24);setOv(0);
setTimeout(function(){
p.classList.remove('open');
if(typeof syncOverlay==='function')syncOverlay();
cleanup();
},330);
}else{
setT(0);setOv(1);
setTimeout(cleanup,330);
}
},{passive:true});
/* одноразовая подсказка «свайп есть» */
function hint(){
if(window.innerWidth>1180)return;
if(sessionStorage.getItem('zt_swipehint'))return;
sessionStorage.setItem('zt_swipehint','1');
p.classList.add('swipe-hint');
var c=document.createElement('div');c.className='swipeHintChip';c.textContent='← свайп закроет профиль';
document.body.appendChild(c);
setTimeout(function(){c.remove();},1700);
p.addEventListener('animationend',function h(){p.classList.remove('swipe-hint');p.removeEventListener('animationend',h);});
}
new MutationObserver(function(){if(p.classList.contains('open'))setTimeout(hint,350);})
.observe(p,{attributes:true,attributeFilter:['class']});
})();
(function(){var s=document.createElement('style');
s.textContent='@media(max-width:1180px){#panel{touch-action:pan-y}}';
document.head.appendChild(s);
})();