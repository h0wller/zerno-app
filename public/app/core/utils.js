/* public/app/core/utils.js — F1.1: чистые утилиты (UMD-ish, shim в window) */
(function () {
  const $ = (s) => document.querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('ru-RU') + ' ₽';
  const fmtTs = (ts) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const ph10 = (v) => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('8')) d = '7' + d.slice(1); return d; };

  function fmtPhone(v) { const d = ph10(v); if (!d) return ''; let r = '+7'; 
 if(d.length>0)r+=' '+d.slice(0,3);if(d.length>3)r+=' '+d.slice(3,6);
 if(d.length>6)r+='-'+d.slice(6,8);if(d.length>8)r+='-'+d.slice(8,10);
 return r; }
 function bindMask(inp){inp.addEventListener('input',()=>{inp.value=fmtPhone(inp.value);
 try{inp.setSelectionRange(inp.value.length,inp.value.length)}catch(e){}})}
  function hoursNow() { const m = new Date().getMonth() + 1; return (m >= 5 && m <= 9) ? '8:00–21:00' : '8:00–20:00'; }
  function hashStr(s) { let h = 9; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 387420489) >>> 0; return h; }
  function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const fmtMulti=p=>{const s=String(p??'');if(!s.includes('/'))return fmt(Number(s)||0);
  return s.split('/').map(x=>fmt(Number(x.trim()))).join(' / ');};

  Object.assign(window, { $, clone, esc, fmt, fmtTs, ph10, fmtPhone, bindMask, hoursNow, hashStr, rng, fmtMulti });
})();