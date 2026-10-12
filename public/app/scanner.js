/* public/app/scanner.js — F2.4: сканер QR кассира (полностью изолирован в IIFE) */
(function () {
  'use strict';
  let scanStream = null, scanTimer = null, curGuest = null, busy = false, frames = 0;

  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  function closeScan() {
    const m = document.getElementById('scanModal');
    if (m) m.hidden = true;
    stopCam();
  }

  function stopCam() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  }

  function loadJsqr() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = './jsqr.js';
      s.onload = res;
      s.onerror = res;
      document.head.appendChild(s);
    });
  }

  async function startCam() {
    const v = document.getElementById('scanVideo');
    const status = document.getElementById('scanStatus');
    if (!v) return;

    frames = 0;
    if (status) status.textContent = 'Включаю камеру…';
    await loadJsqr();
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      v.srcObject = scanStream;
      await v.play();

      const det = ('BarcodeDetector' in window) ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!det && !window.jsQR && status) {
        status.textContent = 'Сканер не поддерживается — введите код вручную';
      }

      scanTimer = setInterval(async () => {
        if (busy || !v.videoWidth) return;
        busy = true;
        frames++;
        try {
          if (det) {
            const c = await det.detect(v);
            if (c.length) return found(c[0].rawValue);
          }
          if (window.jsQR) {
            const widths = [Math.min(800, v.videoWidth), Math.min(480, v.videoWidth), Math.min(1280, v.videoWidth)];
            for (const W of widths) {
              const H = Math.max(2, Math.round(v.videoHeight * (W / v.videoWidth)));
              canvas.width = W;
              canvas.height = H;
              ctx.drawImage(v, 0, 0, W, H);
              const img = ctx.getImageData(0, 0, W, H);
              const d = img.data;
              for (let i = 0; i < d.length; i += 4) {
                let g = (d[i] + d[i + 1] + d[i + 2]) / 3;
                g = (g - 128) * 1.5 + 128;
                g = g < 0 ? 0 : g > 255 ? 255 : g;
                d[i] = d[i + 1] = d[i + 2] = g;
              }
              const q = jsQR(img.data, W, H, { inversionAttempts: 'attemptBoth' });
              if (q && q.data) return found(q.data);
            }
          }
          if (status) status.textContent = 'Держите камеру параллельно QR, поднесите ближе · кадров: ' + frames;
        } catch (e) {}
        busy = false;
      }, 250);
    } catch (e) {
      if (status) status.textContent = 'Камера недоступна — введите код вручную';
    }
  }

  function found(raw) {
    busy = false;
    stopCam();
    const m = document.getElementById('scanModal');
    if (m) m.hidden = true;
    onScanned(raw);
  }

  async function onScanned(raw) {
    const m = String(raw).match(/Z-[0-9A-F]{6}/i);
    const code = (m ? m[0] : String(raw).trim()).toUpperCase();
    if (!code) return;
    try {
      const r = await api('/staff/scan', { method: 'POST', body: { code } });
      showGuest(r.customer);
    } catch (e) {
      if (typeof toast === 'function') toast('QR не найден 🤷', '');
    }
  }

  function showGuest(c) {
    curGuest = c;
    const gc = document.getElementById('guestCard');
    if (gc) gc.hidden = false;
    const name = document.getElementById('gcName');
    if (name) name.textContent = c.name;
    const phone = document.getElementById('gcPhone');
    if (phone) phone.textContent = c.phone;
    renderGuest();
  }

  function renderGuest() {
    if (!curGuest) return;
    const st = document.getElementById('gcStamps');
    if (st) st.textContent = '☕ Штамп(а): ' + curGuest.stamps + ' из 10 · 🎁 Бесплатных: ' + curGuest.free;
    const red = document.getElementById('gcRedeem');
    if (red) red.style.opacity = curGuest.free > 0 ? '1' : '.4';
  }

  // Безопасная инициализация кликов (не падает, если элементов нет в DOM)
  function initBindings() {
    on('scanFab', () => {
      const m = document.getElementById('scanModal');
      if (m) m.hidden = false;
      startCam();
    });
    on('scanClose', closeScan);
    on('scanManualBtn', () => {
      const inp = document.getElementById('scanManual');
      if (inp) onScanned(inp.value);
    });
    on('gcStamp', async () => {
      if (!curGuest) return;
      try {
        const r = await api('/staff/stamp', { method: 'POST', body: { id: curGuest.id } });
        curGuest = r.customer;
        renderGuest();
        if (typeof toast === 'function') toast(r.msg, r.ten ? '🎁' : '');
      } catch (e) {
        if (typeof toast === 'function') toast('Ошибка', '❌');
      }
    });
    on('gcRedeem', async () => {
      if (!curGuest) return;
      try {
        const r = await api('/staff/redeem', { method: 'POST', body: { id: curGuest.id } });
        curGuest = r.customer;
        renderGuest();
        if (typeof toast === 'function') toast('Бесплатный кофе списан 🎁');
      } catch (e) {
        if (typeof toast === 'function') toast('Нет доступных подарков', '❌');
      }
    });
    on('gcClose', () => {
      const gc = document.getElementById('guestCard');
      if (gc) gc.hidden = true;
      curGuest = null;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBindings);
  } else {
    initBindings();
  }
})();