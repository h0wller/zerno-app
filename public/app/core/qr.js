/* public/app/core/qr.js — Ф4.1a: QR-код гостя (полноэкранный + wakeLock).
Было inline-скрипт index.html (строки ~1096–1119). */
function drawQR(cv,seed){
 if(typeof qrcode==='undefined'){setTimeout(()=>drawQR(cv,seed),250);return;}
 const s=String(seed||'guest');
 let q;
 try{q=qrcode(0,'M');q.addData(s);q.make();}
 catch(e){q=qrcode(4,'M');q.addData(s);q.make();}
 const M=q.getModuleCount(),pad=2,T=M+pad*2,cell=cv.width/T,x=cv.getContext('2d');
 x.fillStyle='#FFFDF7';x.fillRect(0,0,cv.width,cv.height);
 x.fillStyle='#101418';
 for(let j=0;j<M;j++)for(let i=0;i<M;i++)if(q.isDark(j,i))
  x.fillRect(Math.floor((i+pad)*cell),Math.floor((j+pad)*cell),Math.ceil(cell),Math.ceil(cell));
}

let wakeLock=null;
function openQRFull(){if(!me){toast('Сначала создайте профиль','👤');openAuth();return}
 $('#qrName').textContent=me.name;
 $('#qrMeta').textContent=`${me.phone} · штампов: ${me.stamps} из 10`+(me.free?` · 🎁 подарок: ${me.free}`:'');
 drawQR($('#qrFull'),me.qr||'guest');
 $('#qrModal').classList.add('show');syncOverlay();
 if('wakeLock' in navigator)navigator.wakeLock.request('screen').then(w=>wakeLock=w).catch(()=>{})}
function closeQRFull(){$('#qrModal').classList.remove('show');syncOverlay();
 if(wakeLock){try{wakeLock.release()}catch(e){}wakeLock=null}}
$('#qrCard').addEventListener('click',closeQRFull);
$('#qrClose').addEventListener('click',e=>{e.stopPropagation();closeQRFull()});
$('#qrOpenBonus').onclick=openQRFull;
$('#qrOpenProfile').onclick=openQRFull;