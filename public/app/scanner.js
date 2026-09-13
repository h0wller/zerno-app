/* public/app/scanner.js — F2.4: сканер QR кассира (полностью изолирован в IIFE) */
(function () {
  'use strict';
  let scanStream = null, scanTimer = null, curGuest = null, busy = false, frames = 0;

  $('#scanFab').onclick = () => { $('#scanModal').hidden = false; startCam(); };
  $('#scanClose').onclick = closeScan;

  function closeScan() { $('#scanModal').hidden = true; stopCam(); }
  function stopCam() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  }
  function loadJsqr() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = './jsqr.js'; s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    });
  }

  async function startCam() {
    const v = $('#scanVideo'); frames = 0;
    $('#scanStatus').textContent = 'Включаю камеру…';
    await loadJsqr();
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      v.srcObject = scanStream; await v.play();
      const det = ('BarcodeDetector' in window) ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!det && !window.jsQR) $('#scanStatus').textContent = 'Сканер не поддерживается — введите код вручную';
      scanTimer = setInterval(async () => {
        if (busy || !v.videoWidth) return; busy = true; frames++;
        try {
          if (det) { const c = await det.detect(v); if (c.length) return found(c[0].rawValue); }
          if (window.jsQR) {
            const widths = [Math.min(800, v.videoWidth), Math.min(480, v.videoWidth), Math.min(1280, v.videoWidth)];
            for (const W of widths) {
              const H = Math.max(2, Math.round(v.videoHeight * (W / v.videoWidth)));
              canvas.width = W; canvas.height = H;
              ctx.drawImage(v, 0, 0, W, H);
              const img = ctx.getImageData(0, 0, W, H);
              const d = img.data;
              for (let i = 0; i < d.length; i += 4) { let g = (d[i] + d[i + 1] + d[i + 2]) / 3; g = (g - 128) * 1.5 + 128; g = g < 0 ? 0 : g > 255 ? 255 : g; d[i] = d[i + 1] = d[i + 2] = g; }
              const q = jsQR(img.data, W, H, { inversionAttempts: 'attemptBoth' });
              if (q && q.data) return found(q.data);
            }
          }
          $('#scanStatus').textContent = 'Держите камеру параллельно QR, поднесите ближе · кадров: ' + frames;
        } catch (e) {}
        busy = false;
      }, 250);
    } catch (e) { $('#scanStatus').textContent = 'Камера недоступна — введите код вручную'; }
  }

  function found(raw) { busy = false; stopCam(); $('#scanModal').hidden = true; onScanned(raw); }

  async function onScanned(raw) {
    const m = String(raw).match(/Z-[0-9A-F]{6}/i);
    const code = (m ? m[0] : String(raw).trim()).toUpperCase();
    if (!code) return;
    try { const r = await api('/staff/scan', { method: 'POST', body: { code } }); showGuest(r.customer); }
    catch (e) { toast('QR не найден 🤷', ''); }
  }
  $('#scanManualBtn').onclick = () => onScanned($('#scanManual').value);

  function showGuest(c) {
    curGuest = c;
    $('#guestCard').hidden = false;
    $('#gcName').textContent = c.name;
    $('#gcPhone').textContent = c.phone;
    renderGuest();
  }
  function renderGuest() {
    $('#gcStamps').textContent = '☕ Штамп(а): ' + curGuest.stamps + ' из 10 · 🎁 Бесплатных: ' + curGuest.free;
    $('#gcRedeem').style.opacity = curGuest.free > 0 ? '1' : '.4';
  }
  $('#gcStamp').onclick = async () => {
    try {
      const r = await api('/staff/stamp', { method: 'POST', body: { id: curGuest.id } });
      curGuest = r.customer; renderGuest();
      toast(r.msg, r.ten ? '🎁' : '');
    } catch (e) { toast('Ошибка', '❌'); }
  };
  $('#gcRedeem').onclick = async () => {
    try {
      const r = await api('/staff/redeem', { method: 'POST', body: { id: curGuest.id } });
      curGuest = r.customer; renderGuest();
      toast('Бесплатный кофе списан 🎁');
    } catch (e) { toast('Нет доступных подарков', '❌'); }
  };
  $('#gcClose').onclick = () => { $('#guestCard').hidden = true; curGuest = null; };
})();